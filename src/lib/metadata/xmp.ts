import type { GroupId, ReportField } from "./report-types"

/**
 * XMP is an XML packet that editors and cameras write into a photo. This is a small, tolerant
 * extractor for the well-known properties, not an XML parser: whatever it finds is returned as
 * plain text, so a hostile packet can only ever produce words on screen.
 */

/** Never read more than this. A real XMP packet is a few kilobytes. */
const MAX_CHARS = 2 * 1024 * 1024

type Row = [name: string, group: GroupId, label: string]

const PROPERTIES: Row[] = [
  ["dc:creator", "author", "Creator"],
  ["dc:rights", "author", "Rights"],
  ["photoshop:Credit", "author", "Credit"],
  ["photoshop:Source", "author", "Source"],
  ["dc:title", "notes", "Title"],
  ["dc:description", "notes", "Description"],
  ["dc:subject", "notes", "Keywords"],
  ["xmp:CreatorTool", "software", "Creator tool"],
  ["stEvt:softwareAgent", "software", "Edited with"],
  ["xmp:CreateDate", "dates", "Created"],
  ["xmp:ModifyDate", "dates", "Modified"],
  ["xmp:MetadataDate", "dates", "Metadata changed"],
  ["photoshop:DateCreated", "dates", "Date created (Photoshop)"],
  ["exif:DateTimeOriginal", "dates", "Taken (XMP)"],
  ["photoshop:City", "location", "City"],
  ["photoshop:State", "location", "State or region"],
  ["photoshop:Country", "location", "Country"],
  ["Iptc4xmpCore:Location", "location", "Place name"],
  ["exif:GPSLatitude", "location", "GPS latitude (XMP)"],
  ["exif:GPSLongitude", "location", "GPS longitude (XMP)"],
  ["tiff:Make", "camera", "Make"],
  ["tiff:Model", "camera", "Model"],
  ["aux:SerialNumber", "camera", "Camera serial number"],
  ["aux:Lens", "camera", "Lens"],
  ["xmpMM:DocumentID", "extras", "Document ID"],
]

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

function unescapeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
    const e = entity.toLowerCase()
    if (e === "amp") return "&"
    if (e === "lt") return "<"
    if (e === "gt") return ">"
    if (e === "quot") return '"'
    if (e === "apos") return "'"
    const code = e.startsWith("#x") ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
  })
}

const clean = (s: string) => unescapeXml(s).trim()

/** Every value the property has: as an element (maybe a list of rdf:li) or as an attribute. */
function valuesOf(xml: string, name: string): string[] {
  const n = escapeRegex(name)
  const found: string[] = []

  for (const m of xml.matchAll(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "g"))) {
    const items = [...m[1].matchAll(/<rdf:li\b[^>]*>([\s\S]*?)<\/rdf:li>/g)].map((li) => li[1])
    // A list holds the items; anything else is the text itself, with markup tags removed.
    for (const raw of items.length ? items : [m[1].replace(/<[^>]*>/g, "")]) found.push(clean(raw.replace(/<[^>]*>/g, "")))
  }
  for (const m of xml.matchAll(new RegExp(`\\b${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "g"))) found.push(clean(m[1] ?? m[2] ?? ""))

  return [...new Set(found.filter(Boolean))]
}

export function parseXmp(text: string): ReportField[] {
  const xml = text.slice(0, MAX_CHARS)
  const out: ReportField[] = []
  for (const [name, group, label] of PROPERTIES) {
    const values = valuesOf(xml, name)
    if (values.length) out.push({ group, label, value: values.join(", "), source: "XMP" })
  }
  return out
}
