import { MetadataError } from "../errors"
import type { Verification, VerifyOptions } from "../types"
import { readExif, TAG_ORIENTATION } from "./exif"
import { appSignature, isApp, isImageDataMarker, isRst, markerName, MARKER, parseJpeg } from "./parse"

/**
 * Re-read a file and report anything beyond what Clean is allowed to leave:
 * structure, one ICC profile (unless removal was requested), an EXIF block with
 * exactly one tag (Orientation), a JFIF header without a thumbnail, Adobe APP14,
 * and nothing after EOI. Anything else is a finding, even a segment nobody listed.
 */
export function verifyCleanJpeg(bytes: Uint8Array, options: VerifyOptions = {}): Verification {
  const findings: string[] = []

  let parsed
  try {
    parsed = parseJpeg(bytes)
  } catch (e) {
    if (e instanceof MetadataError) return { clean: false, findings: [e.message] }
    throw e
  }

  let exifBlocks = 0

  for (const seg of parsed.segments) {
    const m = seg.marker
    if (m === MARKER.SOI || m === MARKER.EOI || isImageDataMarker(m) || isRst(m)) continue

    const label = `${markerName(m)} at byte ${seg.offset}`
    if (!isApp(m)) {
      findings.push(`Unexpected segment: ${label}`)
      continue
    }

    switch (appSignature(bytes, seg)) {
      case "JFIF": {
        const payload = seg.dataEnd - seg.dataStart
        const thumb = payload >= 14 ? bytes[seg.dataStart + 12] + bytes[seg.dataStart + 13] : 1
        if (payload !== 14 || thumb !== 0) findings.push(`JFIF header carries a thumbnail (${label})`)
        break
      }
      case "Adobe":
        break
      case "ICC_PROFILE":
        if (options.removeIcc) findings.push(`Colour profile still present (${label})`)
        break
      case "Exif": {
        exifBlocks++
        const exif = readExif(bytes.subarray(seg.dataStart + 6, seg.dataEnd))
        if (exifBlocks > 1) {
          findings.push(`More than one EXIF block (${label})`)
        } else if (!exif) {
          findings.push(`Unreadable EXIF block (${label})`)
        } else if (exif.entries.length !== 1 || exif.entries[0].ifd !== "ifd0" || exif.entries[0].tag !== TAG_ORIENTATION) {
          findings.push(`EXIF holds more than Orientation: ${exif.entries.length} tags (${label})`)
        }
        break
      }
      default:
        findings.push(`Unexpected segment: ${label}`)
    }
  }

  if (parsed.trailingBytes > 0) findings.push(`${parsed.trailingBytes} bytes of data after the end of the image`)

  return { clean: findings.length === 0, findings }
}
