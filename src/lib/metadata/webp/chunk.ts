import { buildOrientationTiff } from "../exif"

/** FourCC (4) + size (4, LITTLE-endian) + data + one zero pad byte if the size is odd. */
export function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + data.length + (data.length & 1))
  for (let i = 0; i < 4; i++) out[i] = type.charCodeAt(i)
  new DataView(out.buffer).setUint32(4, data.length, true)
  out.set(data, 8)
  return out
}

/** An EXIF chunk holding exactly one tag, Orientation. 34 bytes; layout in docs/formats/webp.md. */
export function buildOrientationExifChunk(orientation: number): Uint8Array {
  return buildChunk("EXIF", buildOrientationTiff(orientation))
}
