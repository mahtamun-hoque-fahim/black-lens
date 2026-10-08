import { readExif, TAG_ORIENTATION } from "../exif"
import { MetadataError } from "../errors"
import type { Verification, VerifyOptions } from "../types"
import { exifPayload, FLAG, FLAGS_KNOWN, frameChunks, FRAME_ALLOWED, parseWebp, readVp8x } from "./parse"

const IMAGE = new Set(["ALPH", "VP8 ", "VP8L", "ANIM"])

/** Re-read a WebP and report anything beyond what Clean is allowed to leave. */
export function verifyCleanWebp(bytes: Uint8Array, options: VerifyOptions = {}): Verification {
  const findings: string[] = []

  let parsed
  try {
    parsed = parseWebp(bytes)
  } catch (e) {
    if (e instanceof MetadataError) return { clean: false, findings: [e.message] }
    throw e
  }

  let exifBlocks = 0
  for (const chunk of parsed.chunks) {
    const label = `${chunk.type.trim()} at byte ${chunk.offset}`
    // The pad byte after an odd-sized chunk must be zero: it is a place data could hide.
    if ((chunk.dataEnd - chunk.dataStart) & 1 && chunk.dataEnd < parsed.riffEnd && bytes[chunk.dataEnd] !== 0) {
      findings.push(`Non-zero pad byte (${label})`)
    }
    if (chunk.type === "VP8X" || IMAGE.has(chunk.type)) continue

    if (chunk.type === "ANMF") {
      for (const sub of frameChunks(bytes, chunk)) {
        if (!FRAME_ALLOWED.has(sub.type)) findings.push(`Unexpected chunk inside an animation frame: ${sub.type.trim()} (${label})`)
      }
    } else if (chunk.type === "ICCP") {
      if (options.removeIcc) findings.push(`Colour profile still present (${label})`)
    } else if (chunk.type === "EXIF") {
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

  // The VP8X flags must describe the file honestly, and the reserved parts must be empty.
  const vp8x = parsed.chunks.find((c) => c.type === "VP8X")
  if (vp8x) {
    const { flags, reserved } = readVp8x(bytes, vp8x)
    const has = (t: string) => parsed.chunks.some((c) => c.type === t)
    if ((flags & ~FLAGS_KNOWN) !== 0 || reserved.some((b) => b !== 0)) findings.push("Reserved header bits are set")
    if (Boolean(flags & FLAG.ICC) !== has("ICCP")) findings.push("Header flags disagree with the colour profile")
    if (Boolean(flags & FLAG.EXIF) !== has("EXIF")) findings.push("Header flags disagree with the EXIF chunk")
    if (flags & FLAG.XMP) findings.push("Header flags still announce XMP")
  }

  if (parsed.trailingBytes > 0) findings.push(`${parsed.trailingBytes} bytes of data after the end of the image`)
  return { clean: findings.length === 0, findings }
}
