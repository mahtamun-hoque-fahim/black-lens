import { readExifFields } from "./exif"
import { describeExif, formatDate } from "./exif-report"
import { inflateZlib } from "./inflate"
import { parseIptc } from "./iptc"
import { jpegParts } from "./jpeg/parts"
import { pngParts, type PngText } from "./png/parts"
import { GROUP_LABELS, GROUP_ORDER, type FieldSource, type GroupId, type MetadataReport, type ReportField, type ReportLocation } from "./report-types"
import { requireSupported } from "./support"
import { webpParts } from "./webp/parts"
import { parseXmp } from "./xmp"

export type { MetadataReport } from "./report-types"

// ---------------------------------------------------------------------------
// Assembling
// ---------------------------------------------------------------------------

/**
 * Sort fields into groups, in the order people read them, and give every label in a group a unique
 * name: two sources saying "Copyright" become "Copyright (EXIF)" and "Copyright (IPTC)", and two
 * comments become "Comment" and "Comment 2".
 */
export function assemble(format: MetadataReport["format"], fields: ReportField[], location: ReportLocation | null): MetadataReport {
  const groups = GROUP_ORDER.flatMap((id) => {
    const seen = new Set<string>()
    const mine = fields.filter((f) => f.group === id).filter((f) => {
      const key = `${f.label}\u0000${f.value}\u0000${f.source}`
      return seen.has(key) ? false : (seen.add(key), true)
    })
    if (mine.length === 0) return []

    const sourcesByLabel = new Map<string, Set<FieldSource>>()
    for (const f of mine) sourcesByLabel.set(f.label, (sourcesByLabel.get(f.label) ?? new Set()).add(f.source))
    const used = new Map<string, number>()
    const named = mine.map((f) => {
      const clash = (sourcesByLabel.get(f.label)?.size ?? 0) > 1
      const base = clash ? `${f.label} (${f.source})` : f.label
      const n = (used.get(base) ?? 0) + 1
      used.set(base, n)
      return { label: n === 1 ? base : `${base} ${n}`, value: f.value, source: f.source }
    })
    return [{ id, label: GROUP_LABELS[id], fields: named }]
  })
  return { format, groups, location }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_TEXT = 1024 * 1024
const add = (out: ReportField[], group: GroupId, label: string, value: string | null | undefined, source: FieldSource) => {
  if (value && value.trim()) out.push({ group, label, value: value.trim().slice(0, 4000), source })
}

/** Text from a file: UTF-8 when it is valid UTF-8, otherwise Latin-1 (older software). */
function decodeText(bytes: Uint8Array): string {
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder("latin1").decode(bytes)
  }
  return text.replace(/\0+/g, " ").trim()
}

function pictureFields(out: ReportField[], size: { width: number; height: number } | null, iccBytes: number) {
  if (size && size.width > 0 && size.height > 0) add(out, "picture", "Size", `${size.width} x ${size.height} pixels`, "File")
  if (iccBytes > 0) add(out, "picture", "Colour profile", `Embedded (${iccBytes} bytes)`, "File")
}

function trailing(out: ReportField[], bytes: number) {
  if (bytes > 0) add(out, "extras", "Extra data after the image", `${bytes} bytes`, "File")
}

// ---------------------------------------------------------------------------
// One reader per format
// ---------------------------------------------------------------------------

function reportJpeg(bytes: Uint8Array): MetadataReport {
  const p = jpegParts(bytes)
  const out: ReportField[] = []
  let location: ReportLocation | null = null

  const read = p.exif ? readExifFields(p.exif) : null
  if (read) {
    const d = describeExif(read)
    out.push(...d.fields)
    location = d.location
  }
  if (p.xmp) out.push(...parseXmp(decodeText(p.xmp)))
  if (p.iptc) out.push(...parseIptc(p.iptc))
  for (const c of p.comments) add(out, "notes", "Comment", decodeText(c), "Comment")

  pictureFields(out, p.size, p.iccBytes)
  trailing(out, p.trailingBytes)
  if (p.mpfBytes > 0) add(out, "extras", "Extra photos inside this file", "Yes (Multi-Picture Format)", "File")
  if (p.jfifThumbnail && !out.some((f) => f.label === "Embedded preview image")) add(out, "extras", "Embedded preview image", "Present", "File")
  for (const u of p.unknownSegments) add(out, "extras", `Unrecognised data (${u.name})`, `${u.size} bytes`, "File")

  return assemble("jpeg", out, location)
}

const PNG_AUTHOR = new Set(["Author", "Artist", "Creator"])
const PNG_DATES: Record<string, string> = { "Creation Time": "Created", "Modification Time": "Modified", "date:create": "Created (file system)", "date:modify": "Modified (file system)" }

async function pngText(t: PngText): Promise<string | null> {
  const raw = t.compressed ? await inflateZlib(t.data, MAX_TEXT) : t.data
  if (!raw) return null
  return t.utf8 ? decodeText(raw) : new TextDecoder("latin1").decode(raw).replace(/\0+/g, " ").trim()
}

async function reportPng(bytes: Uint8Array): Promise<MetadataReport> {
  const p = pngParts(bytes)
  const out: ReportField[] = []
  let location: ReportLocation | null = null

  const read = p.exif ? readExifFields(p.exif) : null
  if (read) {
    const d = describeExif(read)
    out.push(...d.fields)
    location = d.location
  }

  for (const t of p.texts) {
    const value = await pngText(t)
    if (!value) continue
    const k = t.keyword
    if (k === "XML:com.adobe.xmp") out.push(...parseXmp(value))
    else if (/^Raw profile type /i.test(k)) add(out, "extras", `Embedded profile text (${k.slice(17)})`, `${value.length} characters`, "Text")
    else if (PNG_AUTHOR.has(k)) add(out, "author", k, value, "Text")
    else if (k === "Copyright") add(out, "author", "Copyright", value, "Text")
    else if (k === "Software") add(out, "software", "Software", value, "Text")
    else if (k === "Source") add(out, "camera", "Source device", value, "Text")
    else if (PNG_DATES[k]) add(out, "dates", PNG_DATES[k], formatDate(value), "Text")
    else add(out, "notes", k.slice(0, 60), value, "Text")
  }

  if (p.time) add(out, "dates", "Last changed (PNG time stamp)", p.time, "File")
  if (p.resolution) add(out, "picture", "Resolution", `${p.resolution.x} x ${p.resolution.y} pixels per inch`, "File")
  pictureFields(out, p.size, p.iccBytes)
  trailing(out, p.trailingBytes)
  return assemble("png", out, location)
}

function reportWebp(bytes: Uint8Array): MetadataReport {
  const p = webpParts(bytes)
  const out: ReportField[] = []
  let location: ReportLocation | null = null

  const read = p.exif ? readExifFields(p.exif) : null
  if (read) {
    const d = describeExif(read)
    out.push(...d.fields)
    location = d.location
  }
  if (p.xmp) out.push(...parseXmp(decodeText(p.xmp)))

  pictureFields(out, p.size, p.iccBytes)
  if (p.frames > 0) add(out, "picture", "Animation", `${p.frames} ${p.frames === 1 ? "frame" : "frames"}`, "File")
  trailing(out, p.trailingBytes)
  for (const u of p.unknownChunks) add(out, "extras", `Unrecognised data (${u.name})`, `${u.size} bytes`, "File")
  return assemble("webp", out, location)
}

/** Read everything a photo carries and describe it in groups. Throws the same plain errors as cleaning. */
export async function buildReport(bytes: Uint8Array): Promise<MetadataReport> {
  const format = requireSupported(bytes)
  if (format === "png") return reportPng(bytes)
  if (format === "webp") return reportWebp(bytes)
  return reportJpeg(bytes)
}

/** The whole report as plain text, for the "copy everything" button. */
export function reportToText(report: MetadataReport, fileName: string): string {
  const lines = [fileName, ""]
  for (const g of report.groups) lines.push(g.label, ...g.fields.map((f) => `  ${f.label}: ${f.value}`), "")
  return lines.join("\n")
}
