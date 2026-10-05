import type { ExifEntry } from "./jpeg/exif"
import { inspectJpeg } from "./jpeg/inspect"
import { verifyCleanJpeg } from "./jpeg/verify"

/**
 * A plain-language view of what a photo carries, by category. The UI shows this
 * before cleaning. Every flag is "does this photo contain it", never a guess.
 */
export interface MetadataSummary {
  format: "jpeg"
  location: boolean
  camera: boolean
  dates: boolean
  software: boolean
  author: boolean
  /** XMP, IPTC captions and keywords, comments, user notes. */
  notes: boolean
  /** An embedded thumbnail: a second, smaller copy of the picture. */
  preview: boolean
  /** Bytes after the end of the image (motion photo video, a second JPEG, hidden payloads). */
  extraData: boolean
  /** Something identifying is present but fits none of the categories above. */
  other: boolean
  colourProfile: boolean
  orientation: number | null
  /** Re-reading the file finds nothing Clean would remove. */
  alreadyClean: boolean
}

// EXIF tag numbers, grouped by what a person would call them.
const CAMERA = new Set([0x010f, 0x0110, 0x927c, 0xa420, 0xa431, 0xa433, 0xa434, 0xa435, 0xc62f]) // make, model, maker note, unique id, serials, lens
const DATES = new Set([0x0132, 0x9003, 0x9004, 0x9010, 0x9011, 0x9012])
const SOFTWARE = new Set([0x0131])
const AUTHOR = new Set([0x013b, 0x8298, 0xa430]) // artist, copyright, camera owner
const NOTES = new Set([0x010e, 0x9286]) // image description, user comment

const has = (entries: ExifEntry[], tags: Set<number>) =>
  entries.some((e) => (e.ifd === "ifd0" || e.ifd === "exif") && tags.has(e.tag))

export function summarizeJpeg(bytes: Uint8Array): MetadataSummary {
  const info = inspectJpeg(bytes)
  const entries = info.exif?.entries ?? []

  const location = entries.some((e) => e.ifd === "gps")
  const camera = has(entries, CAMERA)
  const dates = has(entries, DATES)
  const software = has(entries, SOFTWARE)
  const author = has(entries, AUTHOR)
  const notes = info.xmp || info.iptc || info.comments > 0 || has(entries, NOTES)
  const preview = entries.some((e) => e.ifd === "ifd1") || info.segments.some((s) => s.signature === "JFXX")
  const extraData = info.trailingBytes > 0
  const alreadyClean = verifyCleanJpeg(bytes).clean

  const named = location || camera || dates || software || author || notes || preview || extraData

  return {
    format: "jpeg",
    location,
    camera,
    dates,
    software,
    author,
    notes,
    preview,
    extraData,
    other: !alreadyClean && !named,
    colourProfile: info.icc,
    orientation: info.orientation,
    alreadyClean,
  }
}
