import { readExif, type ExifData } from "../exif"
import { exifPayload, FLAGS_KNOWN, frameChunks, FRAME_ALLOWED, parseWebp, readVp8x } from "./parse"

const KNOWN = new Set(["VP8X", "ICCP", "ALPH", "ANIM", "ANMF", "VP8 ", "VP8L", "EXIF", "XMP "])

export interface WebpInspection {
  chunks: { type: string; offset: number; size: number }[]
  exif: ExifData | null
  orientation: number | null
  icc: boolean
  xmp: boolean
  /** The VP8X flags byte, or null for a simple file that has no VP8X. */
  flags: number | null
  /** A reserved flag bit or reserved byte in VP8X is set. They are meant to be zero. */
  reservedBitsSet: boolean
  /** Top-level chunks we do not recognise. */
  unknownChunks: string[]
  /** Unrecognised chunks hidden inside animation frames. */
  unknownFrameChunks: number
  animated: boolean
  trailingBytes: number
}

/** Read-only look inside a WebP: its chunks, flags and EXIF tags. */
export function inspectWebp(bytes: Uint8Array): WebpInspection {
  const parsed = parseWebp(bytes)
  const exifChunk = parsed.chunks.find((c) => c.type === "EXIF")
  const exif = exifChunk ? readExif(exifPayload(bytes, exifChunk)) : null
  const vp8x = parsed.chunks.find((c) => c.type === "VP8X")
  const header = vp8x ? readVp8x(bytes, vp8x) : null

  let unknownFrameChunks = 0
  for (const c of parsed.chunks) {
    if (c.type === "ANMF") unknownFrameChunks += frameChunks(bytes, c).filter((s) => !FRAME_ALLOWED.has(s.type)).length
  }

  return {
    chunks: parsed.chunks.map((c) => ({ type: c.type, offset: c.offset, size: c.end - c.offset })),
    exif,
    orientation: exif?.orientation ?? null,
    icc: parsed.chunks.some((c) => c.type === "ICCP"),
    xmp: parsed.chunks.some((c) => c.type === "XMP "),
    flags: header ? header.flags : null,
    reservedBitsSet: header ? (header.flags & ~FLAGS_KNOWN) !== 0 || header.reserved.some((b) => b !== 0) : false,
    unknownChunks: parsed.chunks.map((c) => c.type).filter((t) => !KNOWN.has(t)),
    unknownFrameChunks,
    animated: parsed.chunks.some((c) => c.type === "ANIM" || c.type === "ANMF"),
    trailingBytes: parsed.trailingBytes,
  }
}
