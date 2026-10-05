export type MetadataFormat = "jpeg" | "png" | "webp" | "heic" | "unknown"

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

// Brands that mean "HEIF family" in an ISO base media file's ftyp box
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"])

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let out = ""
  for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i])
  return out
}

/**
 * Decide the format from the first bytes, never from the file name or MIME type.
 * A file called holiday.jpg that holds PNG bytes is a PNG, and treating it as a
 * JPEG would "clean" nothing while claiming success.
 */
export function sniffFormat(bytes: Uint8Array): MetadataFormat {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg"

  if (bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return "png"

  // WebP is a RIFF container: "RIFF", 4 size bytes, then the form type "WEBP"
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp"

  // HEIC/HEIF: 4 size bytes, then "ftyp", then a 4-letter brand
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && HEIC_BRANDS.has(ascii(bytes, 8, 12))) return "heic"

  return "unknown"
}
