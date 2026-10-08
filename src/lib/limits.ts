/**
 * Batch limits. A product decision (see docs/formats/zip.md): big enough for a real
 * photo shoot, small enough that a phone browser does not run out of memory holding
 * the originals and the cleaned copies at the same time.
 */
export const LIMITS = {
  /** Photos in one batch. */
  maxFiles: 200,
  /** One photo. A 100 megapixel JPEG is about 50 MB. */
  maxFileBytes: 100 * 1024 * 1024,
  /** All photos in a batch together. */
  maxTotalBytes: 500 * 1024 * 1024,
} as const
