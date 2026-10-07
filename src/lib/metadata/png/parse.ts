import { MetadataError } from "../errors"

export const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * One chunk. offset .. end covers the whole chunk (length, type, data, CRC).
 * dataStart .. dataEnd is just the data, so dataEnd is where the 4 CRC bytes begin.
 */
export interface PngChunk {
  type: string
  offset: number
  end: number
  dataStart: number
  dataEnd: number
}

export interface ParsedPng {
  chunks: PngChunk[]
  /** Offset just past IEND: where the image really ends. */
  endOffset: number
  trailingBytes: number
}

// The critical chunks this reader understands. Any other uppercase-first chunk is rejected.
const KNOWN_CRITICAL = new Set(["IHDR", "PLTE", "IDAT", "IEND"])

const corrupt = (message: string) => new MetadataError("corrupt", message)

export function parsePng(bytes: Uint8Array): ParsedPng {
  const len = bytes.length
  if (len < 8 + 12 || !SIGNATURE.every((b, i) => bytes[i] === b)) {
    throw corrupt("This is not a valid PNG: the signature is missing.")
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  const chunks: PngChunk[] = []
  let pos = 8
  for (;;) {
    if (pos + 12 > len) throw corrupt("The file ends before the PNG does.")
    const length = view.getUint32(pos)
    if (length > 0x7fffffff) throw corrupt(`A chunk at byte ${pos} has an impossible length.`)
    const end = pos + 12 + length
    if (end > len) throw corrupt("The file ends in the middle of a chunk.")

    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7])
    if (!/^[A-Za-z]{4}$/.test(type)) throw corrupt(`A chunk at byte ${pos} has an invalid name.`)
    if (chunks.length === 0 && (type !== "IHDR" || length !== 13)) throw corrupt("The PNG header is missing or wrong.")
    // Uppercase first letter = critical. We cannot judge a critical chunk we do not know, so we refuse the file.
    if (type[0] === type[0].toUpperCase() && !KNOWN_CRITICAL.has(type)) {
      throw corrupt(`This PNG uses a required part (${type}) that Black Lens does not understand.`)
    }

    chunks.push({ type, offset: pos, end, dataStart: pos + 8, dataEnd: pos + 8 + length })
    pos = end
    if (type === "IEND") break
  }

  if (!chunks.some((c) => c.type === "IDAT")) throw corrupt("The PNG has no image data.")
  return { chunks, endOffset: pos, trailingBytes: len - pos }
}

// Everything a decoder reads to rebuild the pixels (and frames, for an animated PNG).
const IMAGE_DATA = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "acTL", "fcTL", "fdAT"])

export function isImageDataChunk(type: string): boolean {
  return IMAGE_DATA.has(type)
}

/** Concatenate every chunk needed to rebuild the pixels. Equal output means the same image. */
export function extractImageData(bytes: Uint8Array): Uint8Array {
  const parts = parsePng(bytes)
    .chunks.filter((c) => IMAGE_DATA.has(c.type))
    .map((c) => bytes.subarray(c.offset, c.end))
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Text chunks all start with a keyword, then a NUL byte. Returns the keyword (max 79 bytes by spec). */
export function textKeyword(bytes: Uint8Array, chunk: PngChunk): string {
  let kw = ""
  for (let i = chunk.dataStart; i < chunk.dataEnd && i < chunk.dataStart + 79; i++) {
    if (bytes[i] === 0) break
    kw += String.fromCharCode(bytes[i])
  }
  return kw
}

export const isTextChunk = (type: string) => type === "tEXt" || type === "zTXt" || type === "iTXt"

/** The TIFF structure inside an eXIf chunk. Some writers wrongly keep the "Exif\0\0" prefix; tolerate it. */
export function exifPayload(bytes: Uint8Array, chunk: PngChunk): Uint8Array {
  const data = bytes.subarray(chunk.dataStart, chunk.dataEnd)
  const hasPrefix = data.length > 6 && data[0] === 0x45 && data[1] === 0x78 && data[2] === 0x69 && data[3] === 0x66
  return hasPrefix ? data.subarray(6) : data
}
