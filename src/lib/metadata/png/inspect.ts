import { readExif, type ExifData } from "../exif"
import { exifPayload, isTextChunk, parsePng, textKeyword } from "./parse"

export interface PngInspection {
  chunks: { type: string; offset: number; size: number }[]
  exif: ExifData | null
  orientation: number | null
  icc: boolean
  /** XMP lives in an iTXt chunk with the keyword XML:com.adobe.xmp. */
  xmp: boolean
  /** A tIME (last modified) chunk is present. */
  time: boolean
  textKeywords: string[]
  animated: boolean
  trailingBytes: number
}

/** Read-only look inside a PNG: its chunks, EXIF tags and text keywords. */
export function inspectPng(bytes: Uint8Array): PngInspection {
  const parsed = parsePng(bytes)
  const exifChunk = parsed.chunks.find((c) => c.type === "eXIf")
  const exif = exifChunk ? readExif(exifPayload(bytes, exifChunk)) : null
  const textKeywords = parsed.chunks.filter((c) => isTextChunk(c.type)).map((c) => textKeyword(bytes, c))

  return {
    chunks: parsed.chunks.map((c) => ({ type: c.type, offset: c.offset, size: c.end - c.offset })),
    exif,
    orientation: exif?.orientation ?? null,
    icc: parsed.chunks.some((c) => c.type === "iCCP"),
    xmp: textKeywords.includes("XML:com.adobe.xmp"),
    time: parsed.chunks.some((c) => c.type === "tIME"),
    textKeywords,
    animated: parsed.chunks.some((c) => c.type === "acTL"),
    trailingBytes: parsed.trailingBytes,
  }
}
