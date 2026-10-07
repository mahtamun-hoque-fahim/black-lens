import { readExif } from "../exif"
import type { KeptItem, RemovedItem, RemovedKind, StripOptions } from "../types"
import { buildOrientationChunk } from "./chunk"
import { exifPayload, isTextChunk, parsePng } from "./parse"

// Chunks copied through byte for byte (see docs/formats/png.md). iCCP and eXIf are handled separately.
const KEEP = new Set([
  "IHDR", "PLTE", "IDAT", "IEND", // critical
  "tRNS", // transparency
  "gAMA", "cHRM", "sRGB", "cICP", // colour description
  "sBIT", "bKGD", "hIST", "pHYs", // rendering hints
  "acTL", "fcTL", "fdAT", // animation
])

export interface StripResult {
  bytes: Uint8Array
  removed: RemovedItem[]
  kept: KeptItem[]
}

/**
 * Remove everything identifying from a PNG without re-encoding it. Default deny:
 * only chunks in the allow-list are copied, and the pixel chunks are never touched.
 */
export function stripPng(input: Uint8Array, options: StripOptions = {}): StripResult {
  const parsed = parsePng(input)
  const chunks: Uint8Array[] = []
  const removedBytes = new Map<RemovedKind, number>()
  const kept: KeptItem[] = []

  let orientation: number | null = null
  let sawExif = false
  let iccBytes = 0

  const drop = (kind: RemovedKind, bytes: number) => removedBytes.set(kind, (removedBytes.get(kind) ?? 0) + bytes)

  for (const chunk of parsed.chunks) {
    const size = chunk.end - chunk.offset
    const copy = () => chunks.push(input.subarray(chunk.offset, chunk.end))

    if (KEEP.has(chunk.type)) {
      copy()
    } else if (chunk.type === "iCCP") {
      if (options.removeIcc) {
        drop("icc", size)
      } else {
        copy()
        iccBytes += size
      }
    } else if (chunk.type === "eXIf") {
      drop("exif", size)
      if (!sawExif) {
        sawExif = true
        orientation = readExif(exifPayload(input, chunk))?.orientation ?? null
      }
    } else if (isTextChunk(chunk.type)) {
      drop("text", size)
    } else if (chunk.type === "tIME") {
      drop("modified-time", size)
    } else {
      drop("other-segment", size)
    }
  }

  if (parsed.trailingBytes > 0) drop("trailing-data", parsed.trailingBytes)

  // A fresh Orientation-only eXIf goes right after IHDR (index 0), which the PNG rules allow.
  if (orientation !== null) {
    chunks.splice(1, 0, buildOrientationChunk(orientation))
    kept.push({ kind: "orientation", value: orientation })
  }
  if (iccBytes > 0) kept.push({ kind: "icc", bytes: iccBytes })
  kept.push({ kind: "structure" })

  const out = new Uint8Array(8 + chunks.reduce((n, c) => n + c.length, 0))
  out.set(input.subarray(0, 8), 0) // the 8-byte signature
  let at = 8
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }

  return { bytes: out, removed: [...removedBytes].map(([kind, bytes]) => ({ kind, bytes })), kept }
}
