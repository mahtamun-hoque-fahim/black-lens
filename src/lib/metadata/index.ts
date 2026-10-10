import { requireSupported } from "./support"
import { summarizeJpeg, summarizePng, summarizeWebp, type MetadataSummary } from "./summary"

export { MetadataError, type MetadataErrorCode } from "./errors"
export { stripMetadata, type StripMetadataResult } from "./strip-metadata"
export { sniffFormat, type MetadataFormat } from "./sniff"
export type { KeptItem, RemovedItem, RemovedKind, StripOptions } from "./types"
export type { MetadataSummary } from "./summary"
export { buildReport, reportToText } from "./report"
export { tagMetadata, type TagMetadataResult } from "./tag"
export { EMPTY_TAGS, isEmptyTags, normalizeTags, tagLines, TAG_LIMITS, type TagError, type TagField, type TagInput, type Tags } from "./tags"
export type { MetadataReport, ReportField, ReportGroup, ReportLocation } from "./report-types"

/** Look inside a photo and report, by category, what it carries. Changes nothing. */
export function summarizeMetadata(input: Uint8Array): MetadataSummary {
  const format = requireSupported(input)
  if (format === "png") return summarizePng(input)
  if (format === "webp") return summarizeWebp(input)
  return summarizeJpeg(input)
}

