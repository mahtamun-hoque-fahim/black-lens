import type { Tags } from "./tags"

/**
 * Build an EXIF block (a small big-endian TIFF) for the fields EXIF can hold. EXIF text is 7-bit
 * ASCII by specification, so a field is written here only when it is plain ASCII; anything else is
 * carried by XMP and never altered to fit. Layout and rules: docs/tags.md.
 */

export const isPrintableAscii = (s: string) => /^[\x20-\x7E]*$/.test(s)
const isAsciiLines = (s: string) => /^[\x20-\x7E\n]*$/.test(s)

interface Entry {
  tag: number
  type: number // 2 ASCII, 3 SHORT, 4 LONG
  count: number
  bytes: Uint8Array
}

const ascii = (tag: number, text: string): Entry => {
  const bytes = new Uint8Array(text.length + 1) // the text, then a NUL: EXIF strings are NUL-terminated
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return { tag, type: 2, count: bytes.length, bytes }
}

export interface ExifSpec {
  orientation?: number | null
  artist?: string
  description?: string
  copyright?: string
  /** "YYYY:MM:DD HH:MM:SS" */
  dateTimeOriginal?: string
}

/** "2026-01-02" becomes "2026:01:02 00:00:00". EXIF insists on a time; no time is invented beyond midnight. */
export const exifDate = (date: string) => `${date.replace(/-/g, ":")} 00:00:00`

/** The block, or null when there is nothing to put in it. */
export function buildExifTiff(spec: ExifSpec): Uint8Array | null {
  const ifd0: Entry[] = []
  if (spec.description) ifd0.push(ascii(0x010e, spec.description))
  if (spec.orientation) ifd0.push({ tag: 0x0112, type: 3, count: 1, bytes: new Uint8Array([0, spec.orientation]) })
  if (spec.artist) ifd0.push(ascii(0x013b, spec.artist))
  if (spec.copyright) ifd0.push(ascii(0x8298, spec.copyright))
  const exif: Entry[] = spec.dateTimeOriginal ? [ascii(0x9003, spec.dateTimeOriginal)] : []
  if (exif.length) ifd0.push({ tag: 0x8769, type: 4, count: 1, bytes: new Uint8Array(4) }) // pointer, filled in below
  if (ifd0.length === 0) return null
  ifd0.sort((a, b) => a.tag - b.tag) // the specification requires entries in ascending tag order

  const ifdSize = (n: number) => 2 + n * 12 + 4
  const exifAt = 8 + ifdSize(ifd0.length)
  let dataAt = exifAt + (exif.length ? ifdSize(exif.length) : 0)

  const all = [...ifd0, ...exif]
  const out = new Uint8Array(dataAt + all.reduce((n, e) => n + (e.bytes.length > 4 ? e.bytes.length + (e.bytes.length % 2) : 0), 0))
  const view = new DataView(out.buffer)
  out.set([0x4d, 0x4d, 0x00, 0x2a]) // "MM" (big-endian), magic number 42
  view.setUint32(4, 8) // the first directory starts right after this 8-byte header

  const writeIfd = (at: number, entries: Entry[]) => {
    view.setUint16(at, entries.length)
    entries.forEach((e, i) => {
      const p = at + 2 + i * 12
      view.setUint16(p, e.tag)
      view.setUint16(p + 2, e.type)
      view.setUint32(p + 4, e.count)
      if (e.tag === 0x8769) {
        view.setUint32(p + 8, exifAt)
      } else if (e.bytes.length <= 4) {
        out.set(e.bytes, p + 8) // short values live in the entry itself, left-justified
      } else {
        view.setUint32(p + 8, dataAt) // longer ones are stored after the directories, on an even offset
        out.set(e.bytes, dataAt)
        dataAt += e.bytes.length + (e.bytes.length % 2)
      }
    })
    // the 4 bytes after the entries (offset of a next directory) stay zero: there is none
  }
  writeIfd(8, ifd0)
  if (exif.length) writeIfd(exifAt, exif)
  return out
}

/** The EXIF block for these tags. `orientation` is carried over from the photo (or null). */
export function buildExifFromTags(tags: Tags, orientation: number | null): Uint8Array | null {
  return buildExifTiff({
    orientation,
    artist: tags.artist && isPrintableAscii(tags.artist) ? tags.artist : undefined,
    copyright: tags.copyright && isPrintableAscii(tags.copyright) ? tags.copyright : undefined,
    description: tags.description && isAsciiLines(tags.description) ? tags.description : undefined,
    dateTimeOriginal: tags.date ? exifDate(tags.date) : undefined,
  })
}
