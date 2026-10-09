import { MetadataError } from "./errors"
import { sniffFormat, type MetadataFormat } from "./sniff"

/** Throws the right MetadataError for formats we cannot handle (yet); returns the format otherwise. */
export function requireSupported(input: Uint8Array): "jpeg" | "png" | "webp" {
  const format: MetadataFormat = sniffFormat(input)
  if (format === "jpeg" || format === "png" || format === "webp") return format
  if (format === "heic") throw new MetadataError("unsupported", "HEIC photos are not supported yet.")
  throw new MetadataError("unknown-format", "This does not look like a JPEG, PNG or WebP image.")
}
