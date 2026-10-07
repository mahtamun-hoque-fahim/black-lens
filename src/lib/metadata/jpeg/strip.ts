import type { KeptItem, RemovedItem, RemovedKind, StripOptions } from "../types"
import { buildOrientationApp1, readExif } from "./exif"
import { appSignature, isApp, isImageDataMarker, isRst, MARKER, parseJpeg } from "./parse"

export type { KeptItem, RemovedItem, RemovedKind, StripOptions }

export interface StripResult {
  bytes: Uint8Array
  removed: RemovedItem[]
  kept: KeptItem[]
}

// The JFIF payload is 14 bytes: "JFIF\0", version (2), density unit (1), X and Y density (2+2), thumbnail width and height (1+1).
const JFIF_PAYLOAD = 14
const JFIF_FIXED = 12 // everything before the thumbnail size fields

/**
 * Remove everything identifying from a JPEG without re-encoding it.
 *
 * Default deny: only segments in docs/formats/jpeg.md's allow-list are copied
 * through, byte for byte. The image data is never decoded, so it cannot change.
 */
export function stripJpeg(input: Uint8Array, options: StripOptions = {}): StripResult {
  const parsed = parseJpeg(input)
  const chunks: Uint8Array[] = []
  const removedBytes = new Map<RemovedKind, number>()
  const kept: KeptItem[] = []

  let orientation: number | null = null
  let sawExif = false
  let iccBytes = 0
  let jfifIndex = -1

  const drop = (kind: RemovedKind, bytes: number) => removedBytes.set(kind, (removedBytes.get(kind) ?? 0) + bytes)

  for (const seg of parsed.segments) {
    const size = seg.end - seg.offset
    const m = seg.marker
    const copy = () => chunks.push(input.subarray(seg.offset, seg.end))

    // Structure and pixels: SOI, EOI, tables, frame header, scans, restart markers.
    if (m === MARKER.SOI || m === MARKER.EOI || isImageDataMarker(m) || isRst(m)) {
      copy()
      continue
    }

    if (m === MARKER.COM) {
      drop("comment", size)
      continue
    }

    if (!isApp(m)) {
      drop("other-segment", size) // reserved markers (JPGn, TEM) and anything unknown
      continue
    }

    switch (appSignature(input, seg)) {
      case "JFIF": {
        const payload = seg.dataEnd - seg.dataStart
        if (payload < JFIF_PAYLOAD) {
          drop("other-segment", size)
        } else if (
          payload === JFIF_PAYLOAD &&
          input[seg.dataStart + JFIF_FIXED] === 0 &&
          input[seg.dataStart + JFIF_FIXED + 1] === 0
        ) {
          copy() // no thumbnail: pass through untouched
          jfifIndex = chunks.length - 1
        } else {
          // Rebuild the header with thumbnail size 0x0 and drop the thumbnail bytes after it.
          const rebuilt = new Uint8Array(4 + JFIF_PAYLOAD)
          rebuilt.set([0xff, MARKER.APP0, 0x00, 2 + JFIF_PAYLOAD], 0)
          rebuilt.set(input.subarray(seg.dataStart, seg.dataStart + JFIF_FIXED), 4)
          chunks.push(rebuilt)
          jfifIndex = chunks.length - 1
          drop("jfif-thumbnail", size - rebuilt.length)
        }
        break
      }
      case "JFXX":
        drop("jfif-thumbnail", size)
        break
      case "Exif": {
        drop("exif", size)
        if (!sawExif) {
          sawExif = true
          // The only thing we carry over is the Orientation value; the block itself is discarded.
          orientation = readExif(input.subarray(seg.dataStart + 6, seg.dataEnd))?.orientation ?? null
        }
        break
      }
      case "XMP":
        drop("xmp", size)
        break
      case "Photoshop":
        drop("iptc", size)
        break
      case "ICC_PROFILE":
        if (options.removeIcc) {
          drop("icc", size)
        } else {
          copy()
          iccBytes += size
        }
        break
      case "Adobe":
        copy() // carries the colour transform flag CMYK/YCCK decoding needs
        break
      default:
        drop("other-segment", size) // MPF, FlashPix, maker notes, unknown APPn
    }
  }

  if (parsed.trailingBytes > 0) drop("trailing-data", parsed.trailingBytes)

  // Put the fresh Orientation block right after SOI, or after JFIF when JFIF comes first.
  if (orientation !== null) {
    const at = jfifIndex === 1 ? 2 : 1
    chunks.splice(at, 0, buildOrientationApp1(orientation))
    kept.push({ kind: "orientation", value: orientation })
  }
  if (iccBytes > 0) kept.push({ kind: "icc", bytes: iccBytes })
  kept.push({ kind: "structure" })

  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }

  return {
    bytes: out,
    removed: [...removedBytes].map(([kind, bytes]) => ({ kind, bytes })),
    kept,
  }
}
