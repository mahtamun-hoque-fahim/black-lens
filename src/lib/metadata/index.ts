import { MetadataError } from "./errors"
import { extractImageData as jpegImageData } from "./jpeg/parse"
import { stripJpeg } from "./jpeg/strip"
import { verifyCleanJpeg } from "./jpeg/verify"
import { extractImageData as pngImageData } from "./png/parse"
import { stripPng } from "./png/strip"
import { verifyCleanPng } from "./png/verify"
import { sniffFormat, type MetadataFormat } from "./sniff"
import { summarizeJpeg, summarizePng, summarizeWebp, type MetadataSummary } from "./summary"
import type { KeptItem, RemovedItem, StripOptions } from "./types"
import { extractImageData as webpImageData } from "./webp/parse"
import { stripWebp } from "./webp/strip"
import { verifyCleanWebp } from "./webp/verify"

export { MetadataError, type MetadataErrorCode } from "./errors"
export { sniffFormat, type MetadataFormat } from "./sniff"
export type { KeptItem, RemovedItem, RemovedKind, StripOptions } from "./types"
export type { MetadataSummary } from "./summary"

export interface StripMetadataResult {
  format: "jpeg" | "png" | "webp"
  bytes: Uint8Array
  removed: RemovedItem[]
  kept: KeptItem[]
  verification: {
    /** The cleaned file, re-read from scratch, holds nothing identifying. */
    clean: boolean
    /** The pixels (tables, frame header, scans) are byte-identical to the input. */
    imageDataIdentical: boolean
    findings: string[]
  }
}

/** Throws the right MetadataError for formats we cannot handle (yet); returns the format otherwise. */
function requireSupported(input: Uint8Array): "jpeg" | "png" | "webp" {
  const format: MetadataFormat = sniffFormat(input)
  if (format === "jpeg" || format === "png" || format === "webp") return format
  if (format === "heic") throw new MetadataError("unsupported", "HEIC photos are not supported yet.")
  throw new MetadataError("unknown-format", "This does not look like a JPEG, PNG or WebP image.")
}

/** Look inside a photo and report, by category, what it carries. Changes nothing. */
export function summarizeMetadata(input: Uint8Array): MetadataSummary {
  const format = requireSupported(input)
  if (format === "png") return summarizePng(input)
  if (format === "webp") return summarizeWebp(input)
  return summarizeJpeg(input)
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * Clean a photo: detect its format from its bytes, remove identifying metadata,
 * then re-read the output to prove it. If the proof fails, this throws and the
 * caller gets no file: we never hand back something we could not verify.
 */
export function stripMetadata(input: Uint8Array, options: StripOptions = {}): StripMetadataResult {
  const format = requireSupported(input)
  const formats = {
    jpeg: { strip: stripJpeg, verify: verifyCleanJpeg, imageData: jpegImageData },
    png: { strip: stripPng, verify: verifyCleanPng, imageData: pngImageData },
    webp: { strip: stripWebp, verify: verifyCleanWebp, imageData: webpImageData },
  }
  const run = formats[format]

  const result = run.strip(input, options)
  const check = run.verify(result.bytes, options)
  const imageDataIdentical = sameBytes(run.imageData(input), run.imageData(result.bytes))

  if (!check.clean || !imageDataIdentical) {
    throw new MetadataError("verification-failed", "The cleaned file could not be verified, so it was not returned.")
  }

  return {
    format,
    bytes: result.bytes,
    removed: result.removed,
    kept: result.kept,
    verification: { clean: check.clean, imageDataIdentical, findings: check.findings },
  }
}
