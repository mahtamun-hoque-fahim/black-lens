import { MetadataError } from "../errors"

/** JPEG marker codes (the byte after 0xFF). See docs/formats/jpeg.md. */
export const MARKER = {
  TEM: 0x01,
  DHT: 0xc4,
  DAC: 0xcc,
  SOI: 0xd8,
  EOI: 0xd9,
  SOS: 0xda,
  DQT: 0xdb,
  DNL: 0xdc,
  DRI: 0xdd,
  APP0: 0xe0,
  APP1: 0xe1,
  APP2: 0xe2,
  APP13: 0xed,
  APP14: 0xee,
  COM: 0xfe,
} as const

/** Start-of-frame markers C0..CF, except the three that share the range but are not frame headers. */
export const isSof = (m: number) => m >= 0xc0 && m <= 0xcf && m !== MARKER.DHT && m !== 0xc8 && m !== MARKER.DAC
export const isApp = (m: number) => m >= 0xe0 && m <= 0xef
export const isRst = (m: number) => m >= 0xd0 && m <= 0xd7

/** Markers that carry no length and no payload. */
const isStandalone = (m: number) => m === MARKER.TEM || isRst(m)

/**
 * One piece of the file. All offsets are into the original byte array.
 *
 * offset .. end       the whole segment: any fill bytes, FF, marker, length, payload,
 *                     and for SOS also the entropy-coded scan data that follows it
 * dataStart .. dataEnd the payload only (after the 2 length bytes). For SOS this stops
 *                     at the end of the scan header, not the scan data
 */
export interface JpegSegment {
  marker: number
  offset: number
  end: number
  dataStart: number
  dataEnd: number
}

export interface ParsedJpeg {
  segments: JpegSegment[]
  /** Offset just past the first EOI: where the image really ends. */
  endOffset: number
  /** Bytes after that EOI. Real photos have none; motion photos and appended payloads do. */
  trailingBytes: number
}

const corrupt = (message: string) => new MetadataError("corrupt", message)

/**
 * Walk the file segment by segment. Throws MetadataError("corrupt") if the
 * structure is broken, so callers never work on a half-understood file.
 */
export function parseJpeg(bytes: Uint8Array): ParsedJpeg {
  const len = bytes.length
  if (len < 4 || bytes[0] !== 0xff || bytes[1] !== MARKER.SOI) {
    throw corrupt("This is not a valid JPEG: the start marker is missing.")
  }

  const segments: JpegSegment[] = [{ marker: MARKER.SOI, offset: 0, end: 2, dataStart: 2, dataEnd: 2 }]
  let pos = 2

  for (;;) {
    if (pos >= len) throw corrupt("The file ends before the JPEG does.")
    if (bytes[pos] !== 0xff) throw corrupt(`Expected a marker at byte ${pos}.`)

    // Any number of 0xFF "fill" bytes may precede a marker; the marker code is the first non-FF byte.
    let m = pos + 1
    while (m < len && bytes[m] === 0xff) m++
    if (m >= len) throw corrupt("The file ends in the middle of a marker.")

    const marker = bytes[m]
    if (marker === 0x00 || marker === MARKER.SOI) throw corrupt(`Unexpected marker at byte ${pos}.`)

    if (marker === MARKER.EOI) {
      segments.push({ marker, offset: pos, end: m + 1, dataStart: m + 1, dataEnd: m + 1 })
      if (!segments.some((s) => s.marker === MARKER.SOS)) throw corrupt("The JPEG has no image data.")
      return { segments, endOffset: m + 1, trailingBytes: len - (m + 1) }
    }

    if (isStandalone(marker)) {
      segments.push({ marker, offset: pos, end: m + 1, dataStart: m + 1, dataEnd: m + 1 })
      pos = m + 1
      continue
    }

    // Everything else: 2 length bytes (big-endian, counting themselves), then the payload.
    if (m + 2 >= len) throw corrupt("The file ends in the middle of a segment header.")
    const segLen = (bytes[m + 1] << 8) | bytes[m + 2]
    if (segLen < 2) throw corrupt(`A segment at byte ${pos} has an impossible length.`)
    const dataStart = m + 3
    const dataEnd = m + 1 + segLen
    if (dataEnd > len) throw corrupt("The file ends in the middle of a segment.")

    if (marker !== MARKER.SOS) {
      segments.push({ marker, offset: pos, end: dataEnd, dataStart, dataEnd })
      pos = dataEnd
      continue
    }

    // SOS: the compressed pixels follow with no length. Inside them every literal 0xFF is
    // stuffed as FF 00, and restart markers FF D0..D7 are part of the data. Any other
    // FF xx is the next real marker (a DHT or another SOS in a progressive file, or EOI).
    let i = dataEnd
    for (;;) {
      i = bytes.indexOf(0xff, i)
      if (i === -1 || i + 1 >= len) throw corrupt("The file ends in the middle of the image data.")
      const next = bytes[i + 1]
      if (next === 0x00 || isRst(next)) {
        i += 2
        continue
      }
      break
    }
    segments.push({ marker, offset: pos, end: i, dataStart, dataEnd })
    pos = i
  }
}

/** Name for display and debugging. */
export function markerName(m: number): string {
  if (m === MARKER.SOI) return "SOI"
  if (m === MARKER.EOI) return "EOI"
  if (m === MARKER.SOS) return "SOS"
  if (m === MARKER.DQT) return "DQT"
  if (m === MARKER.DHT) return "DHT"
  if (m === MARKER.DAC) return "DAC"
  if (m === MARKER.DRI) return "DRI"
  if (m === MARKER.DNL) return "DNL"
  if (m === MARKER.COM) return "COM"
  if (isSof(m)) return `SOF${m - 0xc0}`
  if (isApp(m)) return `APP${m - 0xe0}`
  if (isRst(m)) return `RST${m - 0xd0}`
  return `FF${m.toString(16).toUpperCase().padStart(2, "0")}`
}

export type AppSignature = "JFIF" | "JFXX" | "Exif" | "XMP" | "ICC_PROFILE" | "MPF" | "FPXR" | "Photoshop" | "Adobe"

// What each APPn payload starts with. Order matters only in that no entry is a prefix of another.
const SIGNATURES: [AppSignature, string][] = [
  ["JFIF", "JFIF\0"],
  ["JFXX", "JFXX\0"],
  ["Exif", "Exif\0"],
  ["XMP", "http://ns.adobe.com/xap/1.0/\0"],
  ["ICC_PROFILE", "ICC_PROFILE\0"],
  ["MPF", "MPF\0"],
  ["FPXR", "FPXR\0"],
  ["Photoshop", "Photoshop 3.0\0"],
  ["Adobe", "Adobe"],
]

/** Which known producer wrote this APPn segment, judged by the text its payload starts with. */
export function appSignature(bytes: Uint8Array, seg: JpegSegment): AppSignature | undefined {
  if (!isApp(seg.marker)) return undefined
  for (const [name, text] of SIGNATURES) {
    if (seg.dataStart + text.length > seg.dataEnd) continue
    let match = true
    for (let i = 0; i < text.length; i++) {
      if (bytes[seg.dataStart + i] !== text.charCodeAt(i)) {
        match = false
        break
      }
    }
    if (match) return name
  }
  return undefined
}

/** Is this segment part of the picture itself (tables, frame header, scans)? */
export function isImageDataMarker(m: number): boolean {
  return (
    m === MARKER.DQT ||
    m === MARKER.DHT ||
    m === MARKER.DAC ||
    m === MARKER.DRI ||
    m === MARKER.DNL ||
    m === MARKER.SOS ||
    isSof(m)
  )
}

/**
 * Concatenate every byte a decoder needs to rebuild the pixels: quantisation and
 * Huffman tables, frame header, restart interval and all scans. Metadata segments
 * are excluded. Two files with equal extractImageData output decode to the same image.
 */
export function extractImageData(bytes: Uint8Array): Uint8Array {
  const parsed = parseJpeg(bytes)
  const parts = parsed.segments.filter((s) => isImageDataMarker(s.marker)).map((s) => bytes.subarray(s.offset, s.end))
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
