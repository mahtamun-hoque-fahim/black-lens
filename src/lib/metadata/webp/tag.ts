import { MetadataError } from "../errors"
import { readExif } from "../exif"
import { buildExifFromTags } from "../exif-write"
import type { Tags } from "../tags"
import { buildXmp } from "../xmp-write"
import { buildChunk } from "./chunk"
import { exifPayload, FLAG, parseWebp, readVp8x } from "./parse"
import { webpParts } from "./parts"

/**
 * Write the tags into a WebP that Clean has already cleaned. A file that already has a VP8X header
 * gets its EXIF replaced and an XMP chunk added. A SIMPLE file (just VP8 or VP8L) has no header, so
 * one is added: the canvas comes from the image header, the alpha flag from the lossless header's
 * alpha bit, then the EXIF and XMP flags. The picture chunks are copied byte for byte.
 */
export function tagWebp(clean: Uint8Array, tags: Tags): Uint8Array {
  const parsed = parseWebp(clean)
  const first = parsed.chunks[0]
  const existing = first.type === "VP8X" ? readVp8x(clean, first) : null

  let orientation: number | null = null
  let alpha = (existing?.flags ?? 0) & FLAG.ALPHA
  const animation = (existing?.flags ?? 0) & FLAG.ANIMATION
  let icc = 0
  const body: Uint8Array[] = []

  for (const c of parsed.chunks) {
    if (c.type === "VP8X" || c.type === "XMP ") continue
    if (c.type === "EXIF") {
      orientation ??= readExif(exifPayload(clean, c))?.orientation ?? null
      continue // replaced below
    }
    if (c.type === "ICCP") icc = FLAG.ICC
    if (!existing && c.type === "VP8L" && c.dataEnd - c.dataStart >= 5 && clean[c.dataStart] === 0x2f) {
      // lossless header: signature byte, then width-1 (14 bits), height-1 (14 bits), alpha_is_used (1 bit), version (3 bits)
      const bits = clean[c.dataStart + 1] | (clean[c.dataStart + 2] << 8) | (clean[c.dataStart + 3] << 16) | (clean[c.dataStart + 4] << 24)
      if ((bits >>> 28) & 1) alpha = FLAG.ALPHA
    }
    // copy with a zeroed pad byte: padding is a place data could hide
    const size = c.dataEnd - c.dataStart
    const copy = new Uint8Array(8 + size + (size & 1))
    copy.set(clean.subarray(c.offset, c.dataEnd))
    body.push(copy)
  }

  const tiff = buildExifFromTags(tags, orientation)
  const xmp = buildXmp(tags)

  let canvas: Uint8Array
  if (existing) {
    canvas = existing.canvas
  } else {
    const size = webpParts(clean).size
    if (!size) throw new MetadataError("corrupt", "The size of this WebP could not be read.")
    canvas = new Uint8Array([
      (size.width - 1) & 0xff, ((size.width - 1) >> 8) & 0xff, ((size.width - 1) >> 16) & 0xff,
      (size.height - 1) & 0xff, ((size.height - 1) >> 8) & 0xff, ((size.height - 1) >> 16) & 0xff,
    ])
  }
  const header = new Uint8Array(10)
  header[0] = alpha | animation | icc | (tiff ? FLAG.EXIF : 0) | (xmp ? FLAG.XMP : 0)
  header.set(canvas, 4) // bytes 1 to 3 stay zero: reserved

  const chunks = [buildChunk("VP8X", header), ...body]
  if (tiff) chunks.push(buildChunk("EXIF", tiff)) // EXIF, then XMP, after the image data
  if (xmp) chunks.push(buildChunk("XMP ", xmp))

  const total = 12 + chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  out.set([0x52, 0x49, 0x46, 0x46], 0) // "RIFF"
  new DataView(out.buffer).setUint32(4, total - 8, true) // the size field is rewritten, little-endian
  out.set([0x57, 0x45, 0x42, 0x50], 8) // "WEBP"
  let at = 12
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}
