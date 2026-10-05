/**
 * A minimal TIFF/EXIF reader and the one writer we need.
 *
 * EXIF is a small TIFF file stored inside an APP1 segment. It is a tree of IFDs
 * (image file directories), each a counted list of 12-byte entries:
 *
 *   tag (2) | type (2) | count (4) | value-or-offset (4)
 *
 * IFD0 holds camera and software tags and points to two more IFDs: the Exif IFD
 * (0x8769: dates, serial numbers, lens) and the GPS IFD (0x8825). IFD1, linked from
 * the end of IFD0, describes the embedded thumbnail.
 */

export type IfdName = "ifd0" | "exif" | "gps" | "interop" | "ifd1"

export interface ExifEntry {
  ifd: IfdName
  tag: number
}

export interface ExifData {
  byteOrder: "II" | "MM"
  entries: ExifEntry[]
  /** Orientation from IFD0, only if it is a valid value 1 to 8. */
  orientation: number | null
}

export const TAG_ORIENTATION = 0x0112
const TAG_EXIF_POINTER = 0x8769
const TAG_GPS_POINTER = 0x8825
const TAG_INTEROP_POINTER = 0xa005
const TYPE_SHORT = 3

/**
 * Read the TIFF structure that starts at the byte-order mark (the bytes after
 * "Exif\0\0"). Returns null if it is not readable. Never throws: EXIF in the wild
 * is often damaged, and a damaged block is simply removed, not an error.
 */
export function readExif(tiff: Uint8Array): ExifData | null {
  if (tiff.length < 8) return null
  const order = String.fromCharCode(tiff[0], tiff[1])
  if (order !== "II" && order !== "MM") return null
  const little = order === "II"
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
  if (view.getUint16(2, little) !== 42) return null

  const entries: ExifEntry[] = []
  let orientation: number | null = null
  const seen = new Set<number>() // stops pointer loops in hostile files

  // Returns the offset of the next IFD in the chain (0 = none).
  const walk = (offset: number, ifd: IfdName): number => {
    if (offset < 8 || offset + 2 > tiff.length || seen.has(offset)) return 0
    seen.add(offset)
    const count = view.getUint16(offset, little)
    let p = offset + 2
    for (let n = 0; n < count; n++, p += 12) {
      if (p + 12 > tiff.length) return 0
      const tag = view.getUint16(p, little)
      entries.push({ ifd, tag })

      if (ifd === "ifd0" && tag === TAG_ORIENTATION && orientation === null) {
        const type = view.getUint16(p + 2, little)
        const valueCount = view.getUint32(p + 4, little)
        // A SHORT that fits in the 4-byte value field sits in its first 2 bytes in either byte order.
        const value = view.getUint16(p + 8, little)
        if (type === TYPE_SHORT && valueCount === 1 && value >= 1 && value <= 8) orientation = value
      }

      if (ifd === "ifd0" && tag === TAG_EXIF_POINTER) walk(view.getUint32(p + 8, little), "exif")
      else if (ifd === "ifd0" && tag === TAG_GPS_POINTER) walk(view.getUint32(p + 8, little), "gps")
      else if (ifd === "exif" && tag === TAG_INTEROP_POINTER) walk(view.getUint32(p + 8, little), "interop")
    }
    if (p + 4 > tiff.length) return 0
    return view.getUint32(p, little)
  }

  const next = walk(view.getUint32(4, little), "ifd0")
  if (next) walk(next, "ifd1")

  return { byteOrder: order, entries, orientation }
}

/**
 * Build a complete APP1 segment (FF E1, length, "Exif\0\0", TIFF) holding exactly
 * one tag: Orientation. 36 bytes on disk. Always big-endian. Layout is documented
 * byte by byte in docs/formats/jpeg.md.
 */
export function buildOrientationApp1(orientation: number): Uint8Array {
  if (!Number.isInteger(orientation) || orientation < 1 || orientation > 8) {
    throw new RangeError("Orientation must be an integer from 1 to 8.")
  }
  return new Uint8Array([
    0xff, 0xe1, // APP1 marker
    0x00, 0x22, // segment length: 34 = 2 (this field) + 32 (payload)
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, // "MM" (big-endian) and the TIFF magic number 42
    0x00, 0x00, 0x00, 0x08, // IFD0 starts 8 bytes after the byte-order mark
    0x00, 0x01, // IFD0 has one entry
    0x01, 0x12, // tag 0x0112, Orientation
    0x00, 0x03, // type SHORT
    0x00, 0x00, 0x00, 0x01, // count 1
    0x00, orientation, 0x00, 0x00, // the value, left-justified in the 4-byte field
    0x00, 0x00, 0x00, 0x00, // offset of the next IFD: none
  ])
}
