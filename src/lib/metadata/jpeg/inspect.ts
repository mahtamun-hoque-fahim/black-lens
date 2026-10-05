import { readExif, type ExifData } from "./exif"
import { appSignature, markerName, parseJpeg, type AppSignature } from "./parse"

export interface InspectedSegment {
  marker: number
  name: string
  offset: number
  size: number
  signature?: AppSignature
}

export interface JpegInspection {
  segments: InspectedSegment[]
  /** Tags found in the first EXIF block, or null if there is no readable EXIF. */
  exif: ExifData | null
  orientation: number | null
  icc: boolean
  xmp: boolean
  iptc: boolean
  comments: number
  trailingBytes: number
}

/** Read-only look inside a JPEG: which segments exist and which EXIF tags they hold. */
export function inspectJpeg(bytes: Uint8Array): JpegInspection {
  const parsed = parseJpeg(bytes)
  const segments: InspectedSegment[] = parsed.segments.map((seg) => ({
    marker: seg.marker,
    name: markerName(seg.marker),
    offset: seg.offset,
    size: seg.end - seg.offset,
    signature: appSignature(bytes, seg),
  }))

  const firstExif = parsed.segments.find((s) => appSignature(bytes, s) === "Exif")
  // Skip "Exif\0\0": the TIFF structure starts after those 6 bytes.
  const exif = firstExif ? readExif(bytes.subarray(firstExif.dataStart + 6, firstExif.dataEnd)) : null

  return {
    segments,
    exif,
    orientation: exif?.orientation ?? null,
    icc: segments.some((s) => s.signature === "ICC_PROFILE"),
    xmp: segments.some((s) => s.signature === "XMP"),
    iptc: segments.some((s) => s.signature === "Photoshop"),
    comments: segments.filter((s) => s.name === "COM").length,
    trailingBytes: parsed.trailingBytes,
  }
}
