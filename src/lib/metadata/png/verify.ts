import { readExif, TAG_ORIENTATION } from "../exif"
import { MetadataError } from "../errors"
import type { Verification, VerifyOptions } from "../types"
import { exifPayload, isImageDataChunk, parsePng } from "./parse"

// Everything besides pixel chunks that a clean PNG may still contain (docs/formats/png.md).
const STRUCTURAL = new Set(["IEND", "gAMA", "cHRM", "sRGB", "cICP", "sBIT", "bKGD", "hIST", "pHYs"])

/** Re-read a PNG and report anything beyond what Clean is allowed to leave. */
export function verifyCleanPng(bytes: Uint8Array, options: VerifyOptions = {}): Verification {
  const findings: string[] = []

  let parsed
  try {
    parsed = parsePng(bytes)
  } catch (e) {
    if (e instanceof MetadataError) return { clean: false, findings: [e.message] }
    throw e
  }

  let exifBlocks = 0
  for (const chunk of parsed.chunks) {
    const label = `${chunk.type} at byte ${chunk.offset}`
    if (isImageDataChunk(chunk.type) || STRUCTURAL.has(chunk.type)) continue

    if (chunk.type === "iCCP") {
      if (options.removeIcc) findings.push(`Colour profile still present (${label})`)
    } else if (chunk.type === "eXIf") {
      exifBlocks++
      const exif = readExif(exifPayload(bytes, chunk))
      if (exifBlocks > 1) findings.push(`More than one EXIF block (${label})`)
      else if (!exif) findings.push(`Unreadable EXIF block (${label})`)
      else if (exif.entries.length !== 1 || exif.entries[0].ifd !== "ifd0" || exif.entries[0].tag !== TAG_ORIENTATION) {
        findings.push(`EXIF holds more than Orientation: ${exif.entries.length} tags (${label})`)
      }
    } else {
      findings.push(`Unexpected chunk: ${label}`)
    }
  }

  if (parsed.trailingBytes > 0) findings.push(`${parsed.trailingBytes} bytes of data after the end of the image`)
  return { clean: findings.length === 0, findings }
}
