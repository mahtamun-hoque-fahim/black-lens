/**
 * CRC-32: the checksum PNG chunks and ZIP entries both use (and gzip, and Ethernet). It is computed over a
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
