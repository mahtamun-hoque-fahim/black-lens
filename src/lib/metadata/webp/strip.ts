import { readExif } from "../exif"
import type { KeptItem, RemovedItem, RemovedKind, StripOptions } from "../types"
import { buildChunk, buildOrientationExifChunk } from "./chunk"
import { exifPayload, FLAG, FRAME_ALLOWED, FRAME_HEADER, frameChunks, parseWebp, readVp8x, type WebpChunk } from "./parse"

export interface StripResult {
  bytes: Uint8Array
  removed: RemovedItem[]
  kept: KeptItem[]
}

/**
 * Remove everything identifying from a WebP without re-encoding it. Default deny:
 * only chunks in docs/formats/webp.md's allow-list survive, the pixel chunks are copied
 * byte for byte, and the VP8X flags and RIFF size are rewritten to match the result.
 */
export function stripWebp(input: Uint8Array, options: StripOptions = {}): StripResult {
  const parsed = parseWebp(input)
  const chunks: Uint8Array[] = []
  const removedBytes = new Map<RemovedKind, number>()
  const kept: KeptItem[] = []

  let orientation: number | null = null
  let sawExif = false
  let iccBytes = 0
  let vp8x: WebpChunk | null = null

  const drop = (kind: RemovedKind, bytes: number) => removedBytes.set(kind, (removedBytes.get(kind) ?? 0) + bytes)

  // Copy a chunk with a freshly zeroed pad byte: padding is a place data could hide.
  const copy = (c: WebpChunk): Uint8Array => {
    const size = c.dataEnd - c.dataStart
    const out = new Uint8Array(8 + size + (size & 1))
    out.set(input.subarray(c.offset, c.dataEnd), 0)
    return out
  }

  for (const chunk of parsed.chunks) {
    const size = chunk.end - chunk.offset
    switch (chunk.type) {
      case "VP8X":
        vp8x = chunk
        chunks.push(new Uint8Array(0)) // placeholder at index 0; the real header is built once the flags are known
        break
      case "ICCP":
        if (options.removeIcc) {
          drop("icc", size)
        } else {
          chunks.push(copy(chunk))
          iccBytes += size
        }
        break
      case "ALPH":
      case "VP8 ":
      case "VP8L":
      case "ANIM":
        chunks.push(copy(chunk))
        break
      case "ANMF": {
        const subs = frameChunks(input, chunk)
        const allowed = subs.filter((s) => FRAME_ALLOWED.has(s.type))
        if (allowed.length === subs.length) {
          chunks.push(copy(chunk)) // nothing hidden inside: keep the frame as it is
        } else {
          // Rebuild the frame without the unknown sub-chunks. Its size field is rewritten by buildChunk.
          for (const s of subs) if (!FRAME_ALLOWED.has(s.type)) drop("other-segment", s.end - s.offset)
          const parts = [input.subarray(chunk.dataStart, chunk.dataStart + FRAME_HEADER), ...allowed.map(copy)]
          const payload = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
          let at = 0
          for (const p of parts) {
            payload.set(p, at)
            at += p.length
          }
          chunks.push(buildChunk("ANMF", payload))
        }
        break
      }
      case "EXIF":
        drop("exif", size)
        if (!sawExif) {
          sawExif = true
          orientation = readExif(exifPayload(input, chunk))?.orientation ?? null
        }
        break
      case "XMP ":
        drop("xmp", size)
        break
      default:
        drop("other-segment", size)
    }
  }

  if (parsed.trailingBytes > 0) drop("trailing-data", parsed.trailingBytes)

  // A simple file (no VP8X) cannot hold an EXIF chunk, so there is nothing to carry over.
  if (!vp8x) orientation = null

  if (orientation !== null) {
    chunks.push(buildOrientationExifChunk(orientation)) // EXIF goes after the image data
    kept.push({ kind: "orientation", value: orientation })
  }
  if (iccBytes > 0) kept.push({ kind: "icc", bytes: iccBytes })
  kept.push({ kind: "structure" })

  if (vp8x) {
    const orig = readVp8x(input, vp8x)
    const payload = new Uint8Array(10)
    // Keep only alpha and animation from the original; ICC and EXIF must match what is really inside; XMP is gone.
    payload[0] = (orig.flags & (FLAG.ALPHA | FLAG.ANIMATION)) | (iccBytes > 0 ? FLAG.ICC : 0) | (orientation !== null ? FLAG.EXIF : 0)
    payload.set(orig.canvas, 4) // bytes 1 to 3 stay zero: reserved
    chunks[0] = buildChunk("VP8X", payload)
  }

  const total = 12 + chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  out.set([0x52, 0x49, 0x46, 0x46], 0) // "RIFF"
  new DataView(out.buffer).setUint32(4, total - 8, true) // the size field must be rewritten, little-endian
  out.set([0x57, 0x45, 0x42, 0x50], 8) // "WEBP"
  let at = 12
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }

  return { bytes: out, removed: [...removedBytes].map(([kind, bytes]) => ({ kind, bytes })), kept }
}
