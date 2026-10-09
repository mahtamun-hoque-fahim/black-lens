import { appSignature, isApp, isSof, MARKER, parseJpeg } from "./parse"

/** Every place a JPEG can keep information, pulled out as raw bytes for the readers to describe. */
export interface JpegParts {
  /** The bare TIFF block of the first EXIF segment. */
  exif: Uint8Array | null
  /** The XMP packet (UTF-8 XML). */
  xmp: Uint8Array | null
  /** The Photoshop resource blocks, which hold IPTC. */
  iptc: Uint8Array | null
  comments: Uint8Array[]
  size: { width: number; height: number } | null
  /** Bytes of embedded colour profile. */
  iccBytes: number
  trailingBytes: number
  /** Segments no reader here understands, by name and size. */
  unknownSegments: { name: string; size: number }[]
  /** Bytes in the index of extra embedded photos (Multi-Picture Format). */
  mpfBytes: number
  /** An embedded second copy of the picture inside the JFIF header. */
  jfifThumbnail: boolean
}

const XMP_PREFIX = 29 // "http://ns.adobe.com/xap/1.0/" plus its NUL
const PHOTOSHOP_PREFIX = 14 // "Photoshop 3.0" plus its NUL
const ICC_PREFIX = 14 // "ICC_PROFILE" plus its NUL and 2 chunk bytes

export function jpegParts(bytes: Uint8Array): JpegParts {
  const parsed = parseJpeg(bytes)
  const parts: JpegParts = {
    exif: null,
    xmp: null,
    iptc: null,
    comments: [],
    size: null,
    iccBytes: 0,
    trailingBytes: parsed.trailingBytes,
    unknownSegments: [],
    mpfBytes: 0,
    jfifThumbnail: false,
  }

  for (const seg of parsed.segments) {
    const payload = bytes.subarray(seg.dataStart, seg.dataEnd)
    if (isSof(seg.marker) && !parts.size && payload.length >= 5) {
      // precision (1), height (2), width (2)
      parts.size = { height: (payload[1] << 8) | payload[2], width: (payload[3] << 8) | payload[4] }
    } else if (seg.marker === MARKER.COM) {
      parts.comments.push(payload.slice())
    } else if (isApp(seg.marker)) {
      switch (appSignature(bytes, seg)) {
        case "Exif":
          parts.exif ??= payload.subarray(6).slice()
          break
        case "XMP":
          parts.xmp ??= payload.subarray(XMP_PREFIX).slice()
          break
        case "Photoshop":
          parts.iptc ??= payload.subarray(PHOTOSHOP_PREFIX).slice()
          break
        case "ICC_PROFILE":
          parts.iccBytes += Math.max(0, payload.length - ICC_PREFIX)
          break
        case "MPF":
          parts.mpfBytes += payload.length
          break
        case "JFIF":
          if (payload.length > 14 || payload[12] !== 0 || payload[13] !== 0) parts.jfifThumbnail = true
          break
        case "JFXX":
          parts.jfifThumbnail = true
          break
        case "Adobe":
        case "FPXR":
          break
        default:
          parts.unknownSegments.push({ name: `APP${seg.marker - 0xe0}`, size: payload.length })
      }
    }
  }
  return parts
}
