import { MetadataError } from "./errors"
import { extractImageData } from "./jpeg/parse"
import { stripJpeg, type KeptItem, type RemovedItem, type StripOptions } from "./jpeg/strip"
import { verifyCleanJpeg } from "./jpeg/verify"
import { sniffFormat, type MetadataFormat } from "./sniff"

export { MetadataError, type MetadataErrorCode } from "./errors"
export { sniffFormat, type MetadataFormat } from "./sniff"
export type { KeptItem, RemovedItem, StripOptions } from "./jpeg/strip"

export interface StripMetadataResult {
  format: "jpeg"
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
  const format: MetadataFormat = sniffFormat(input)

  if (format === "heic") throw new MetadataError("unsupported", "HEIC photos are not supported yet.")
  if (format === "png" || format === "webp") {
    throw new MetadataError("unsupported", `${format.toUpperCase()} cleaning is not supported yet.`)
  }
  if (format !== "jpeg") throw new MetadataError("unknown-format", "This does not look like a JPEG, PNG or WebP image.")

  const result = stripJpeg(input, options)
  const check = verifyCleanJpeg(result.bytes, options)
  const imageDataIdentical = sameBytes(extractImageData(input), extractImageData(result.bytes))

  if (!check.clean || !imageDataIdentical) {
    throw new MetadataError("verification-failed", "The cleaned file could not be verified, so it was not returned.")
  }

  return {
    format: "jpeg",
    bytes: result.bytes,
    removed: result.removed,
    kept: result.kept,
    verification: { clean: check.clean, imageDataIdentical, findings: check.findings },
  }
}
