import { buildOrientationTiff } from "../exif"

/**
 * CRC-32 as PNG uses it (the same checksum as zip and gzip). It is computed over a
 * chunk's type and data, never its length. The table holds the result of running
 * the polynomial 0xEDB88320 over every possible byte, so each input byte is one lookup.
 */
const TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** length (4) + type (4) + data + CRC (4), all big-endian. */
export function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** An eXIf chunk holding exactly one tag, Orientation. 38 bytes; layout in docs/formats/png.md. */
export function buildOrientationChunk(orientation: number): Uint8Array {
  return buildChunk("eXIf", buildOrientationTiff(orientation))
}
