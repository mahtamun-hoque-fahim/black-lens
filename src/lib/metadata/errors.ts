/**
 * Every failure the metadata core can report. The UI maps these codes to plain
 * sentences; the core never decides the wording.
 *
 * - corrupt: the file claims to be this format but its structure is broken
 * - unsupported: a format we recognise but do not handle yet (HEIC, and for now PNG/WebP)
 * - unknown-format: not an image we know at all
 * - verification-failed: we cleaned the file but could not prove it clean, so we refuse to return it
 */
export type MetadataErrorCode = "corrupt" | "unsupported" | "unknown-format" | "verification-failed"

export class MetadataError extends Error {
  readonly code: MetadataErrorCode

  constructor(code: MetadataErrorCode, message: string) {
    super(message)
    this.name = "MetadataError"
    this.code = code
  }
}
