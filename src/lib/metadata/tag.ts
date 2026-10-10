import { MetadataError } from "./errors"
import { extractImageData as jpegImageData } from "./jpeg/parse"
import { tagJpeg } from "./jpeg/tag"
import { stripMetadata, type StripMetadataResult } from "./strip-metadata"
import { extractImageData as pngImageData } from "./png/parse"
import { tagPng } from "./png/tag"
import { buildReport } from "./report"
import type { MetadataReport } from "./report-types"
import { isEmptyTags, normalizeTags, tagLines, type TagInput, type Tags } from "./tags"
import type { StripOptions } from "./types"
import { extractPixelChunks } from "./webp/parse"
import { webpParts } from "./webp/parts"
import { tagWebp } from "./webp/tag"

export interface TagMetadataResult extends Omit<StripMetadataResult, "verification"> {
  /** What was written, as plain label and value pairs. */
  written: { label: string; value: string }[]
  verification: {
    /** The cleaned photo passed Clean's own check before anything was written. */
    clean: boolean
    /** The picture itself is byte-identical to the original. */
    imageDataIdentical: boolean
    /** Every value written was read back exactly, and nothing else was found. */
    tagsReadBack: boolean
    findings: string[]
  }
}

// Picture facts that are not about the person. Anything else under Picture is a finding.
const PICTURE_LABELS = new Set(["Size", "Colour profile", "Orientation", "Resolution", "Animation", "Colour space"])

/**
 * Read the finished file again, with the same reader View uses, and report anything that is not
 * exactly what was asked for: a value nobody typed, a location, anything under Hidden extras, or a
 * typed value that did not come back.
 */
function checkTagged(report: MetadataReport, tags: Tags): string[] {
  const findings: string[] = []
  const typed = new Set([tags.artist, tags.copyright, tags.title, tags.description, tags.keywords.join(", "), tags.date, `${tags.date} 00:00:00`].filter(Boolean))

  if (report.location) findings.push("A location is still in the file.")
  for (const group of report.groups) {
    for (const field of group.fields) {
      if (group.id === "picture") {
        if (!PICTURE_LABELS.has(field.label.replace(/ \((EXIF|XMP|IPTC|Text|Comment|File)\)$/, ""))) findings.push(`Unexpected ${field.label}`)
      } else if (!typed.has(field.value)) {
        findings.push(`${field.label} holds something that was not typed: ${field.value.slice(0, 40)}`)
      }
    }
  }

  const has = (group: string, value: string) => report.groups.find((g) => g.id === group)?.fields.some((f) => f.value === value || f.value.startsWith(`${value} `)) ?? false
  const back: [string, string, string][] = [
    ["Artist", "author", tags.artist],
    ["Copyright", "author", tags.copyright],
    ["Title", "notes", tags.title],
    ["Description", "notes", tags.description],
    ["Keywords", "notes", tags.keywords.join(", ")],
    ["Date", "dates", tags.date],
  ]
  for (const [label, group, value] of back) if (value && !has(group, value)) findings.push(`${label} could not be read back`)
  return findings
}

/**
 * Tag a photo: clean it exactly as Clean does, then write only the fields that were filled in, and
 * prove the result. If any check fails nothing is returned. Rules and layout: docs/tags.md.
 */
export async function tagMetadata(input: Uint8Array, tagInput: TagInput, options: StripOptions = {}): Promise<TagMetadataResult> {
  const { tags, errors } = normalizeTags(tagInput)
  if (errors.length > 0) throw new MetadataError("invalid-tags", errors[0].message)
  if (isEmptyTags(tags)) throw new MetadataError("invalid-tags", "Fill in at least one field.")

  // Step one is Clean, unchanged: same code, same proof. If the file cannot be cleaned, this throws.
  const cleaned = stripMetadata(input, options)

  const tagged = cleaned.format === "png" ? tagPng(cleaned.bytes, tags) : cleaned.format === "webp" ? tagWebp(cleaned.bytes, tags) : tagJpeg(cleaned.bytes, tags)

  const report = await buildReport(tagged)
  const findings = checkTagged(report, tags)

  let imageDataIdentical: boolean
  if (cleaned.format === "webp") {
    // A header may have been added, so compare the picture chunks and the canvas size separately.
    const a = webpParts(input).size
    const b = webpParts(tagged).size
    imageDataIdentical = same(extractPixelChunks(input), extractPixelChunks(tagged)) && a?.width === b?.width && a?.height === b?.height
  } else {
    const data = cleaned.format === "png" ? pngImageData : jpegImageData
    imageDataIdentical = same(data(input), data(tagged))
  }

  if (findings.length > 0 || !imageDataIdentical) {
    throw new MetadataError("verification-failed", "The tagged photo could not be verified, so it was not returned.")
  }

  return {
    format: cleaned.format,
    bytes: tagged,
    removed: cleaned.removed,
    kept: cleaned.kept,
    written: tagLines(tags),
    verification: { clean: cleaned.verification.clean, imageDataIdentical, tagsReadBack: true, findings },
  }
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
