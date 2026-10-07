import { buildOrientationTiff } from "../exif"

export { readExif, TAG_ORIENTATION, type ExifData, type ExifEntry, type IfdName } from "../exif"

/**
 * Build a complete APP1 segment (FF E1, length, "Exif\0\0", TIFF) holding exactly
 * one tag: Orientation. 36 bytes on disk. Layout is documented byte by byte in
 * docs/formats/jpeg.md.
 */
export function buildOrientationApp1(orientation: number): Uint8Array {
  const tiff = buildOrientationTiff(orientation)
  const out = new Uint8Array(4 + 6 + tiff.length)
  out.set([0xff, 0xe1, 0x00, 0x22], 0) // APP1 marker, length 34 = 2 (itself) + 6 + 26
  out.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 4) // "Exif\0\0"
  out.set(tiff, 10)
  return out
}
