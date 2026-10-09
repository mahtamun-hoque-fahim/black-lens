import { exifPayload, isTextChunk, parsePng, textKeyword } from "./parse"

export interface PngText {
  keyword: string
  chunk: "tEXt" | "zTXt" | "iTXt"
  /** The text bytes, still compressed when `compressed` is true. */
  data: Uint8Array
  compressed: boolean
  /** iTXt is UTF-8; tEXt and zTXt are Latin-1. */
  utf8: boolean
}

/** Every place a PNG can keep information, as raw bytes for the readers to describe. */
export interface PngParts {
  size: { width: number; height: number }
  exif: Uint8Array | null
  texts: PngText[]
  iccBytes: number
  time: string | null
  resolution: { x: number; y: number } | null
  trailingBytes: number
}

const MAX_TEXTS = 200
const pad = (n: number, w = 2) => String(n).padStart(w, "0")

export function pngParts(bytes: Uint8Array): PngParts {
  const parsed = parsePng(bytes)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts: PngParts = {
    size: { width: 0, height: 0 },
    exif: null,
    texts: [],
    iccBytes: 0,
    time: null,
    resolution: null,
    trailingBytes: parsed.trailingBytes,
  }

  for (const c of parsed.chunks) {
    const data = bytes.subarray(c.dataStart, c.dataEnd)
    if (c.type === "IHDR") {
      parts.size = { width: view.getUint32(c.dataStart), height: view.getUint32(c.dataStart + 4) }
    } else if (c.type === "eXIf") {
      parts.exif ??= exifPayload(bytes, c).slice()
    } else if (c.type === "iCCP") {
      parts.iccBytes += data.length
    } else if (c.type === "tIME" && data.length === 7) {
      parts.time = `${pad(view.getUint16(c.dataStart), 4)}-${pad(data[2])}-${pad(data[3])} ${pad(data[4])}:${pad(data[5])}:${pad(data[6])}`
    } else if (c.type === "pHYs" && data.length === 9 && data[8] === 1) {
      // pixels per metre; 0.0254 metres to an inch
      parts.resolution = {
        x: Math.round(view.getUint32(c.dataStart) * 0.0254),
        y: Math.round(view.getUint32(c.dataStart + 4) * 0.0254),
      }
    } else if (isTextChunk(c.type) && parts.texts.length < MAX_TEXTS) {
      const keyword = textKeyword(bytes, c)
      const rest = c.dataStart + keyword.length + 1 // skip the keyword and its NUL
      if (rest > c.dataEnd) continue
      if (c.type === "tEXt") {
        parts.texts.push({ keyword, chunk: "tEXt", data: bytes.subarray(rest, c.dataEnd).slice(), compressed: false, utf8: false })
      } else if (c.type === "zTXt") {
        // compression method byte, then the zlib stream
        parts.texts.push({ keyword, chunk: "zTXt", data: bytes.subarray(rest + 1, c.dataEnd).slice(), compressed: true, utf8: false })
      } else {
        // iTXt: compression flag, method, language tag + NUL, translated keyword + NUL, then the text
        const compressed = bytes[rest] === 1
        let at = rest + 2
        for (let nuls = 0; nuls < 2 && at < c.dataEnd; at++) if (bytes[at] === 0) nuls++
        parts.texts.push({ keyword, chunk: "iTXt", data: bytes.subarray(at, c.dataEnd).slice(), compressed, utf8: true })
      }
    }
  }
  return parts
}
