/**
 * What View mode shows. A report is plain data (no classes, no functions), so it can cross the
 * Web Worker boundary and be copied as text.
 */

export type GroupId = "location" | "camera" | "dates" | "software" | "author" | "notes" | "picture" | "extras"

export const GROUP_ORDER: GroupId[] = ["location", "camera", "dates", "software", "author", "notes", "picture", "extras"]

export const GROUP_LABELS: Record<GroupId, string> = {
  location: "Location",
  camera: "Camera",
  dates: "Dates",
  software: "Software",
  author: "Author and copyright",
  notes: "Captions and notes",
  picture: "Picture",
  extras: "Hidden extras",
}

export type FieldSource = "EXIF" | "XMP" | "IPTC" | "Text" | "Comment" | "File"

export interface ReportField {
  group: GroupId
  label: string
  value: string
  source: FieldSource
}

export interface ReportGroup {
  id: GroupId
  label: string
  fields: { label: string; value: string; source: FieldSource }[]
}

export interface ReportLocation {
  latitude: number
  longitude: number
  altitude: number | null
  /** "22.365067, 91.830033": what people paste into a map themselves. */
  text: string
}

export interface MetadataReport {
  format: "jpeg" | "png" | "webp"
  groups: ReportGroup[]
  location: ReportLocation | null
}
