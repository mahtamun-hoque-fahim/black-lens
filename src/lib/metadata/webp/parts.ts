import { exifPayload, FRAME_ALLOWED, frameChunks, parseWebp, readVp8x } from "./parse"

export interface WebpParts {
  size: { width: number; height: number } | null
  exif: Uint8Array | null
  xmp: Uint8Array | null
  iccBytes: number
  frames: number
  /** Chunks nobody here understands, including ones hidden inside animation frames. */
  unknownChunks: { name: string; size: number }[]
  trailingBytes: number
}

const KNOWN = new Set(["VP8X", "ICCP", "ALPH", "ANIM", "ANMF", "VP8 ", "VP8L", "EXIF", "XMP "])

export function webpParts(bytes: Uint8Array): WebpParts {
  const parsed = parseWebp(bytes)
  const parts: WebpParts = { size: null, exif: null, xmp: null, iccBytes: 0, frames: 0, unknownChunks: [], trailingBytes: parsed.trailingBytes }

  for (const c of parsed.chunks) {
    const size = c.dataEnd - c.dataStart
    if (c.type === "VP8X") {
      // canvas width - 1 and height - 1, 24 bits each, little-endian
      const { canvas } = readVp8x(bytes, c)
      parts.size = {
        width: (canvas[0] | (canvas[1] << 8) | (canvas[2] << 16)) + 1,
        height: (canvas[3] | (canvas[4] << 8) | (canvas[5] << 16)) + 1,
      }
    } else if (c.type === "VP8 " && !parts.size && size >= 10 && bytes[c.dataStart + 3] === 0x9d && bytes[c.dataStart + 4] === 0x01 && bytes[c.dataStart + 5] === 0x2a) {
      // lossy: a start code, then width and height in 14 bits each
      const d = c.dataStart + 6
      parts.size = { width: (bytes[d] | (bytes[d + 1] << 8)) & 0x3fff, height: (bytes[d + 2] | (bytes[d + 3] << 8)) & 0x3fff }
    } else if (c.type === "VP8L" && !parts.size && size >= 5 && bytes[c.dataStart] === 0x2f) {
      // lossless: a signature byte, then width - 1 and height - 1 in 14 bits each
      const d = c.dataStart + 1
      const bits = bytes[d] | (bytes[d + 1] << 8) | (bytes[d + 2] << 16) | (bytes[d + 3] << 24)
      parts.size = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    } else if (c.type === "EXIF") {
      parts.exif ??= exifPayload(bytes, c).slice()
    } else if (c.type === "XMP ") {
      parts.xmp ??= bytes.slice(c.dataStart, c.dataEnd)
    } else if (c.type === "ICCP") {
      parts.iccBytes += size
    } else if (c.type === "ANMF") {
      parts.frames++
      for (const s of frameChunks(bytes, c)) {
        if (!FRAME_ALLOWED.has(s.type)) parts.unknownChunks.push({ name: `${s.type.trim()} inside an animation frame`, size: s.dataEnd - s.dataStart })
      }
    }
    if (!KNOWN.has(c.type)) parts.unknownChunks.push({ name: c.type.trim(), size })
  }
  return parts
}
