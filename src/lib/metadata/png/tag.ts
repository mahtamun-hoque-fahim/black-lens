import { readExif } from "../exif"
import { buildExifFromTags } from "../exif-write"
import type { Tags } from "../tags"
import { buildXmp } from "../xmp-write"
import { buildChunk } from "./chunk"
import { exifPayload, parsePng } from "./parse"

/** iTXt: keyword, NUL, compression flag 0, method 0, empty language tag + NUL, empty translated keyword + NUL, then UTF-8 text. */
function itxt(keyword: string, text: Uint8Array): Uint8Array {
  const head = new Uint8Array(keyword.length + 5)
  for (let i = 0; i < keyword.length; i++) head[i] = keyword.charCodeAt(i) // keywords are ASCII
  const data = new Uint8Array(head.length + text.length)
  data.set(head)
  data.set(text, head.length)
  return buildChunk("iTXt", data)
}

/**
 * Write the tags into a PNG that Clean has already cleaned: a fuller eXIf, the standard text chunks
 * and an XMP chunk, all right after IHDR (before the image data, where the PNG rules allow them).
 */
export function tagPng(clean: Uint8Array, tags: Tags): Uint8Array {
  const parsed = parsePng(clean)
  const utf8 = (s: string) => new TextEncoder().encode(s)

  let orientation: number | null = null
  const kept: Uint8Array[] = []
  for (const c of parsed.chunks) {
    if (c.type === "eXIf") {
      orientation ??= readExif(exifPayload(clean, c))?.orientation ?? null
      continue // replaced below
    }
    kept.push(clean.subarray(c.offset, c.end))
  }

  const insert: Uint8Array[] = []
  const tiff = buildExifFromTags(tags, orientation)
  if (tiff) insert.push(buildChunk("eXIf", tiff))
  if (tags.artist) insert.push(itxt("Author", utf8(tags.artist)))
  if (tags.copyright) insert.push(itxt("Copyright", utf8(tags.copyright)))
  if (tags.title) insert.push(itxt("Title", utf8(tags.title)))
  if (tags.description) insert.push(itxt("Description", utf8(tags.description)))
  if (tags.date) insert.push(itxt("Creation Time", utf8(tags.date)))
  const xmp = buildXmp(tags)
  if (xmp) insert.push(itxt("XML:com.adobe.xmp", xmp))

  kept.splice(1, 0, ...insert) // index 0 is IHDR
  const out = new Uint8Array(8 + kept.reduce((n, c) => n + c.length, 0))
  out.set(clean.subarray(0, 8)) // the signature
  let at = 8
  for (const c of kept) {
    out.set(c, at)
    at += c.length
  }
  return out
}
