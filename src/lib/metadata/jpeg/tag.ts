import { readExif } from "../exif"
import { buildExifFromTags } from "../exif-write"
import type { Tags } from "../tags"
import { buildXmp } from "../xmp-write"
import { appSignature, MARKER, parseJpeg } from "./parse"

const EXIF_PREFIX = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]) // "Exif\0\0"
const XMP_PREFIX = new TextEncoder().encode("http://ns.adobe.com/xap/1.0/\0")

function app1(prefix: Uint8Array, body: Uint8Array): Uint8Array {
  const length = 2 + prefix.length + body.length
  if (length > 0xffff) throw new RangeError("A JPEG segment cannot hold more than 65,533 bytes.")
  const out = new Uint8Array(2 + length)
  out.set([0xff, MARKER.APP1, length >> 8, length & 0xff])
  out.set(prefix, 4)
  out.set(body, 4 + prefix.length)
  return out
}

/**
 * Write the tags into a JPEG that Clean has already cleaned. The orientation-only EXIF block is
 * replaced by a fuller one and an XMP segment is added right after it, directly after the JFIF header
 * (where Clean put its own EXIF). Nothing else moves; the scan data is never touched.
 */
export function tagJpeg(clean: Uint8Array, tags: Tags): Uint8Array {
  const parsed = parseJpeg(clean)
  const chunks: Uint8Array[] = []
  let orientation: number | null = null
  let jfifIndex = -1

  for (const seg of parsed.segments) {
    const sig = appSignature(clean, seg)
    if (sig === "Exif") {
      orientation ??= readExif(clean.subarray(seg.dataStart + 6, seg.dataEnd))?.orientation ?? null
      continue // replaced below
    }
    chunks.push(clean.subarray(seg.offset, seg.end))
    if (sig === "JFIF") jfifIndex = chunks.length - 1
  }

  const insert: Uint8Array[] = []
  const tiff = buildExifFromTags(tags, orientation)
  if (tiff) insert.push(app1(EXIF_PREFIX, tiff))
  const xmp = buildXmp(tags)
  if (xmp) insert.push(app1(XMP_PREFIX, xmp))
  chunks.splice(jfifIndex === 1 ? 2 : 1, 0, ...insert)

  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}
