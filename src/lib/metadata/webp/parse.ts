import { MetadataError } from "../errors"

/**
 * One chunk. offset .. end covers the whole chunk including its pad byte.
 * dataStart .. dataEnd is the payload only (its length is the chunk's declared size).
 */
export interface WebpChunk {
  type: string
  offset: number
  end: number
  dataStart: number
  dataEnd: number
}

export interface ParsedWebp {
  chunks: WebpChunk[]
  /** Where the RIFF container ends: 8 + the size field. Anything after it is not part of the image. */
  riffEnd: number
  trailingBytes: number
}

const corrupt = (message: string) => new MetadataError("corrupt", message)

const ascii = (bytes: Uint8Array, start: number, end: number) => {
  let s = ""
  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i])
  return s
}

/** Split a run of chunks. Used for the top level and again inside ANMF animation frames. */
function readChunks(bytes: Uint8Array, view: DataView, start: number, end: number, what: string): WebpChunk[] {
  const chunks: WebpChunk[] = []
  let pos = start
  while (pos < end) {
    if (pos + 8 > end) throw corrupt(`A ${what} ends in the middle of a chunk header.`)
    const size = view.getUint32(pos + 4, true) // sizes are little-endian in RIFF
    const dataEnd = pos + 8 + size
    if (dataEnd > end) throw corrupt(`A chunk in the ${what} is larger than the data around it.`)
    // Even-length padding. Some writers omit it on the very last chunk, so clamp instead of failing.
    const chunkEnd = Math.min(dataEnd + (size & 1), end)
    chunks.push({ type: ascii(bytes, pos, pos + 4), offset: pos, end: chunkEnd, dataStart: pos + 8, dataEnd })
    pos = chunkEnd
  }
  return chunks
}

export function parseWebp(bytes: Uint8Array): ParsedWebp {
  const len = bytes.length
  if (len < 12 + 8 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WEBP") {
    throw corrupt("This is not a valid WebP: the header is missing.")
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const riffEnd = 8 + view.getUint32(4, true)
  if (riffEnd > len) throw corrupt("The file ends before the WebP does.")

  const chunks = readChunks(bytes, view, 12, riffEnd, "WebP")
  if (chunks.length === 0 || !["VP8X", "VP8 ", "VP8L"].includes(chunks[0].type)) {
    throw corrupt("The WebP does not start with an image header.")
  }
  const vp8x = chunks[0]
  if (vp8x.type === "VP8X" && vp8x.dataEnd - vp8x.dataStart < 10) throw corrupt("The WebP header is too short.")
  if (!chunks.some((c) => ["VP8 ", "VP8L", "ANMF"].includes(c.type))) throw corrupt("The WebP has no image data.")

  return { chunks, riffEnd, trailingBytes: len - riffEnd }
}

/** VP8X: flags byte, 3 reserved bytes, then canvas width-1 and height-1 (3 bytes each). */
export const FLAG = { ICC: 0x20, ALPHA: 0x10, EXIF: 0x08, XMP: 0x04, ANIMATION: 0x02 } as const
export const FLAGS_KNOWN = FLAG.ICC | FLAG.ALPHA | FLAG.EXIF | FLAG.XMP | FLAG.ANIMATION

export function readVp8x(bytes: Uint8Array, chunk: WebpChunk) {
  const d = chunk.dataStart
  return {
    flags: bytes[d],
    reserved: bytes.subarray(d + 1, d + 4),
    canvas: bytes.subarray(d + 4, d + 10),
  }
}

/** Chunks allowed inside an animation frame. Anything else there is removed. */
export const FRAME_ALLOWED = new Set(["ALPH", "VP8 ", "VP8L"])

/** An ANMF payload is a 16-byte frame header followed by ordinary chunks. */
export const FRAME_HEADER = 16

export function frameChunks(bytes: Uint8Array, anmf: WebpChunk): WebpChunk[] {
  if (anmf.dataEnd - anmf.dataStart < FRAME_HEADER) throw corrupt("An animation frame is too short.")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return readChunks(bytes, view, anmf.dataStart + FRAME_HEADER, anmf.dataEnd, "animation frame")
}

const IMAGE_CHUNKS = new Set(["ALPH", "VP8 ", "VP8L", "ANIM"])

/**
 * Concatenate everything a decoder needs to rebuild the pixels: canvas size, every image,
 * alpha and animation chunk, and each frame header with its allowed sub-chunks.
 * Equal output means the same picture.
 */
export function extractImageData(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = []
  for (const c of parseWebp(bytes).chunks) {
    if (c.type === "VP8X") parts.push(readVp8x(bytes, c).canvas)
    else if (IMAGE_CHUNKS.has(c.type)) parts.push(bytes.subarray(c.offset, c.dataEnd))
    else if (c.type === "ANMF") {
      parts.push(bytes.subarray(c.dataStart, c.dataStart + FRAME_HEADER))
      for (const s of frameChunks(bytes, c)) if (FRAME_ALLOWED.has(s.type)) parts.push(bytes.subarray(s.offset, s.dataEnd))
    }
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** The TIFF structure inside an EXIF chunk. Some writers wrongly keep the "Exif\0\0" prefix; tolerate it. */
export function exifPayload(bytes: Uint8Array, chunk: WebpChunk): Uint8Array {
  const data = bytes.subarray(chunk.dataStart, chunk.dataEnd)
  const hasPrefix = data.length > 6 && data[0] === 0x45 && data[1] === 0x78 && data[2] === 0x69 && data[3] === 0x66
  return hasPrefix ? data.subarray(6) : data
}
