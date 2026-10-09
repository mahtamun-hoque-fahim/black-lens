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

export type ExifValue = string | number | number[] | Uint8Array | null

export interface ExifField {
  ifd: IfdName
  tag: number
  /** TIFF type: 1 BYTE, 2 ASCII, 3 SHORT, 4 LONG, 5 RATIONAL, 6 SBYTE, 7 UNDEFINED, 8 SSHORT, 9 SLONG, 10 SRATIONAL, 11 FLOAT, 12 DOUBLE */
  type: number
  count: number
  /** Size of the value in bytes, even when it was too big or too odd to decode. */
  size: number
  /** Decoded value; null when it is unreadable, points outside the block, or is too big to decode. */
  value: ExifValue
  /** For RATIONAL and SRATIONAL: the exact numerator and denominator of each value. */
  rationals?: [number, number][]
}

export interface ExifFields {
  byteOrder: "II" | "MM"
  fields: ExifField[]
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }
/** A value bigger than this is not decoded (it is still counted). Real EXIF values are tiny; maker notes are the largest. */
const MAX_VALUE_BYTES = 1 << 20
const MAX_ARRAY_ITEMS = 4096

type Decoded = Pick<ExifField, "type" | "count" | "size" | "value" | "rationals">

function decodeValue(tiff: Uint8Array, view: DataView, little: boolean, p: number): Decoded {
  const type = view.getUint16(p + 2, little)
  const count = view.getUint32(p + 4, little)
  const unit = TYPE_SIZE[type]
  if (!unit) return { type, count, size: 0, value: null }

  const size = unit * count
  if (count === 0 || size > MAX_VALUE_BYTES) return { type, count, size, value: null }

  // A value of 4 bytes or less lives in the entry itself; anything bigger is stored elsewhere and the entry holds its offset.
  const at = size <= 4 ? p + 8 : view.getUint32(p + 8, little)
  if (at + size > tiff.length) return { type, count, size, value: null }

  if (type === 2) {
    const bytes = tiff.subarray(at, at + size)
    const end = bytes.indexOf(0)
    return { type, count, size, value: new TextDecoder("utf-8").decode(end < 0 ? bytes : bytes.subarray(0, end)).trim() }
  }
  if (type === 7) return { type, count, size, value: tiff.slice(at, at + size) }
  if (count > MAX_ARRAY_ITEMS) return { type, count, size, value: null }

  const nums: number[] = []
  const pairs: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const o = at + i * unit
    switch (type) {
      case 1:
        nums.push(tiff[o])
        break
      case 6:
        nums.push(view.getInt8(o))
        break
      case 3:
        nums.push(view.getUint16(o, little))
        break
      case 8:
        nums.push(view.getInt16(o, little))
        break
      case 4:
        nums.push(view.getUint32(o, little))
        break
      case 9:
        nums.push(view.getInt32(o, little))
        break
      case 11:
        nums.push(view.getFloat32(o, little))
        break
      case 12:
        nums.push(view.getFloat64(o, little))
        break
      case 5:
      case 10: {
        const num = type === 5 ? view.getUint32(o, little) : view.getInt32(o, little)
        const den = type === 5 ? view.getUint32(o + 4, little) : view.getInt32(o + 4, little)
        pairs.push([num, den])
        nums.push(den === 0 ? NaN : num / den)
        break
      }
    }
  }
  const value = count === 1 ? nums[0] : nums
  return pairs.length ? { type, count, size, value, rationals: pairs } : { type, count, size, value }
}

/**
 * Read every entry of the TIFF structure that starts at the byte-order mark (the bytes after
 * "Exif\0\0"), with its decoded value. Returns null if it is not readable. Never throws: EXIF in
 * the wild is often damaged, and a damaged entry just has no value.
 */
export function readExifFields(tiff: Uint8Array): ExifFields | null {
  if (tiff.length < 8) return null
  const order = String.fromCharCode(tiff[0], tiff[1])
  if (order !== "II" && order !== "MM") return null
  const little = order === "II"
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
  if (view.getUint16(2, little) !== 42) return null

  const fields: ExifField[] = []
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
      fields.push({ ifd, tag, ...decodeValue(tiff, view, little, p) })

      if (ifd === "ifd0" && tag === TAG_EXIF_POINTER) walk(view.getUint32(p + 8, little), "exif")
      else if (ifd === "ifd0" && tag === TAG_GPS_POINTER) walk(view.getUint32(p + 8, little), "gps")
      else if (ifd === "exif" && tag === TAG_INTEROP_POINTER) walk(view.getUint32(p + 8, little), "interop")
    }
    if (p + 4 > tiff.length) return 0
    return view.getUint32(p, little)
  }

  const next = walk(view.getUint32(4, little), "ifd0")
  if (next) walk(next, "ifd1")

  return { byteOrder: order, fields }
}

/**
 * Which tags are present, and the Orientation. Built on readExifFields so there is one EXIF walker,
 * not two that could drift apart.
 */
export function readExif(tiff: Uint8Array): ExifData | null {
  const read = readExifFields(tiff)
  if (!read) return null
  const orientation = read.fields.find(
    (f) => f.ifd === "ifd0" && f.tag === TAG_ORIENTATION && f.type === TYPE_SHORT && f.count === 1 && typeof f.value === "number" && f.value >= 1 && f.value <= 8,
  )
  return {
    byteOrder: read.byteOrder,
    entries: read.fields.map((f) => ({ ifd: f.ifd, tag: f.tag })),
    orientation: orientation ? (orientation.value as number) : null,
  }
}

/**
 * The TIFF structure holding exactly one tag, Orientation: 26 bytes, always big-endian.
 * JPEG wraps it in an APP1 segment behind "Exif\0\0"; PNG stores it bare in an eXIf chunk.
 */
export function buildOrientationTiff(orientation: number): Uint8Array {
  if (!Number.isInteger(orientation) || orientation < 1 || orientation > 8) {
    throw new RangeError("Orientation must be an integer from 1 to 8.")
  }
  return new Uint8Array([
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

