import type { ExifField, ExifFields, ExifValue } from "./exif"
import type { GroupId, ReportField, ReportLocation } from "./report-types"

/**
 * Turn raw EXIF tags into labelled, readable fields for the View screen. Anything not listed here
 * is either harmless technical detail (ignored on purpose) or counted in "Other technical tags",
 * so nothing is silently dropped.
 */

// ---------------------------------------------------------------------------
// Small formatters
// ---------------------------------------------------------------------------

const trim = (n: number, decimals: number) => Number(n.toFixed(decimals)).toString()
const asText = (v: ExifValue): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const asNumber = (v: ExifValue): number | null => {
  const n = Array.isArray(v) ? v[0] : v
  return typeof n === "number" && Number.isFinite(n) ? n : null
}
const asBytes = (v: ExifValue): Uint8Array | null => (v instanceof Uint8Array ? v : Array.isArray(v) ? Uint8Array.from(v) : null)

const ORIENTATION: Record<number, string> = {
  1: "Normal",
  2: "Mirrored left to right",
  3: "Rotated 180 degrees",
  4: "Mirrored top to bottom",
  5: "Mirrored and rotated 90 degrees anticlockwise",
  6: "Rotated 90 degrees clockwise",
  7: "Mirrored and rotated 90 degrees clockwise",
  8: "Rotated 90 degrees anticlockwise",
}

/** "2026:01:02 03:04:05" becomes "2026-01-02 03:04:05". Anything that is not a real date is shown exactly as written. */
function formatDate(raw: string): string {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(raw)
  if (!m) return raw
  const month = Number(m[2])
  const day = Number(m[3])
  if (Number(m[1]) === 0 || month < 1 || month > 12 || day < 1 || day > 31) return raw
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}`
}

function exposureTime(f: ExifField): string | null {
  const pair = f.rationals?.[0]
  const v = asNumber(f.value)
  if (v === null || v <= 0) return null
  if (pair && pair[0] === 1 && pair[1] > 1) return `1/${pair[1]} s`
  return v >= 1 ? `${trim(v, 1)} s` : `1/${Math.round(1 / v)} s`
}

/** UserComment and a few GPS fields begin with an 8-byte label saying how the rest is encoded. */
function decodeCharsetText(bytes: Uint8Array | null, littleEndian: boolean): string | null {
  if (!bytes || bytes.length <= 8) return null
  const label = new TextDecoder("latin1").decode(bytes.subarray(0, 8))
  const body = bytes.subarray(8)
  const encoding = label.startsWith("UNICODE") ? (littleEndian ? "utf-16le" : "utf-16be") : "utf-8"
  const out = new TextDecoder(encoding).decode(body).replace(/\0+$/g, "").trim()
  return out || null
}

/** The Windows (XP) fields store UTF-16 little-endian text as plain bytes. */
function decodeXp(v: ExifValue): string | null {
  const bytes = asBytes(v)
  if (!bytes) return null
  return new TextDecoder("utf-16le").decode(bytes).replace(/\0+$/g, "").trim() || null
}

// ---------------------------------------------------------------------------
// Tag tables: [group, label, formatter]
// ---------------------------------------------------------------------------

type Format = (f: ExifField, little: boolean) => string | null
type Entry = [GroupId, string, Format]

const text: Format = (f) => asText(f.value)
const date: Format = (f) => {
  const t = asText(f.value)
  return t ? formatDate(t) : null
}
const mm: Format = (f) => {
  const n = asNumber(f.value)
  return n === null ? null : `${trim(n, 1)} mm`
}

const IFD0: Record<number, Entry> = {
  0x010e: ["notes", "Description", text],
  0x010f: ["camera", "Make", text],
  0x0110: ["camera", "Model", text],
  0x0112: ["picture", "Orientation", (f) => ORIENTATION[asNumber(f.value) ?? 0] ?? null],
  0x0131: ["software", "Software", text],
  0x0132: ["dates", "Last changed", date],
  0x013b: ["author", "Artist", text],
  0x8298: ["author", "Copyright", text],
  0x9c9b: ["notes", "Title (Windows)", (f) => decodeXp(f.value)],
  0x9c9c: ["notes", "Comment (Windows)", (f) => decodeXp(f.value)],
  0x9c9d: ["author", "Author (Windows)", (f) => decodeXp(f.value)],
  0x9c9e: ["notes", "Keywords (Windows)", (f) => decodeXp(f.value)],
  0x9c9f: ["notes", "Subject (Windows)", (f) => decodeXp(f.value)],
}

const EXIF: Record<number, Entry> = {
  0x829a: ["camera", "Exposure time", exposureTime],
  0x829d: ["camera", "Aperture", (f) => (asNumber(f.value) === null ? null : `f/${trim(asNumber(f.value)!, 1)}`)],
  0x8827: ["camera", "ISO", (f) => (asNumber(f.value) === null ? null : String(asNumber(f.value)))],
  0x9003: ["dates", "Taken", date],
  0x9004: ["dates", "Digitized", date],
  0x9010: ["dates", "Time zone (last changed)", text],
  0x9011: ["dates", "Time zone (taken)", text],
  0x9012: ["dates", "Time zone (digitized)", text],
  0x920a: ["camera", "Focal length", mm],
  0x9286: ["notes", "User comment", (f, little) => decodeCharsetText(asBytes(f.value), little)],
  0xa001: ["picture", "Colour space", (f) => ({ 1: "sRGB", 0xffff: "Not calibrated" })[asNumber(f.value) ?? -1] ?? null],
  0xa405: ["camera", "Focal length (35mm equivalent)", mm],
  0xa420: ["camera", "Unique image ID", text],
  0xa430: ["author", "Camera owner", text],
  0xa431: ["camera", "Camera serial number", text],
  0xa433: ["camera", "Lens make", text],
  0xa434: ["camera", "Lens", text],
  0xa435: ["camera", "Lens serial number", text],
}

// Technical tags with nothing identifying in them, left out on purpose so the list stays short.
const IGNORED_IFD0 = new Set([0x0100, 0x0101, 0x0102, 0x0103, 0x0106, 0x0111, 0x0115, 0x0116, 0x0117, 0x011a, 0x011b, 0x011c, 0x0128, 0x0213, 0x8769, 0x8825])
const IGNORED_EXIF = new Set([
  0x8822, 0x9000, 0x9101, 0x9102, 0x9201, 0x9202, 0x9204, 0x9205, 0x9206, 0x9207, 0x9208, 0x9209, 0x927c, 0x9290, 0x9291, 0x9292,
  0xa000, 0xa002, 0xa003, 0xa005, 0xa20e, 0xa20f, 0xa210, 0xa217, 0xa300, 0xa301, 0xa401, 0xa402, 0xa403, 0xa404, 0xa406, 0xa407,
  0xa408, 0xa409, 0xa40a, 0xa40c, 0xa432,
])

// ---------------------------------------------------------------------------
// GPS
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, "0")

/** Degrees, minutes, seconds (as stored) to one decimal number. */
function toDecimal(dms: number[]): number {
  return dms[0] + (dms[1] ?? 0) / 60 + (dms[2] ?? 0) / 3600
}

function formatDms(dms: number[], ref: string): string {
  return `${trim(dms[0], 6)}° ${trim(dms[1] ?? 0, 6)}' ${trim(dms[2] ?? 0, 2)}" ${ref}`
}

const numbers = (v: ExifValue): number[] | null =>
  Array.isArray(v) && v.length >= 1 && v.every((n) => Number.isFinite(n)) ? v : typeof v === "number" && Number.isFinite(v) ? [v] : null

function describeGps(gps: ExifField[], little: boolean, out: ReportField[]): ReportLocation | null {
  if (gps.length === 0) return null
  const at = (tag: number) => gps.find((f) => f.tag === tag)
  const add = (label: string, value: string | null) => {
    if (value) out.push({ group: "location", label, value, source: "EXIF" })
  }

  const latRef = asText(at(1)?.value ?? null)?.toUpperCase()
  const lonRef = asText(at(3)?.value ?? null)?.toUpperCase()
  const lat = numbers(at(2)?.value ?? null)
  const lon = numbers(at(4)?.value ?? null)

  let location: ReportLocation | null = null
  const usable = lat && lon && (latRef === "N" || latRef === "S") && (lonRef === "E" || lonRef === "W") && lat.length === 3 && lon.length === 3
  if (usable) {
    const latitude = (latRef === "S" ? -1 : 1) * toDecimal(lat)
    const longitude = (lonRef === "W" ? -1 : 1) * toDecimal(lon)
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      const altitudeRaw = asNumber(at(6)?.value ?? null)
      const below = asNumber(at(5)?.value ?? null) === 1
      const altitude = altitudeRaw === null ? null : below ? -altitudeRaw : altitudeRaw
      const textValue = `${trim(latitude, 6)}, ${trim(longitude, 6)}`
      location = { latitude, longitude, altitude, text: textValue }
      add("Coordinates", textValue)
      add("Latitude", formatDms(lat, latRef!))
      add("Longitude", formatDms(lon, lonRef!))
      if (altitudeRaw !== null) add("Altitude", `${trim(altitudeRaw, 2)} m ${below ? "below" : "above"} sea level`)
    }
  }
  if (!location && (at(1) || at(2) || at(3) || at(4))) add("GPS data", "Present, but it could not be read")

  const clock = numbers(at(7)?.value ?? null)
  const day = asText(at(0x1d)?.value ?? null)
  if (clock && clock.length === 3) {
    const time = `${pad2(clock[0])}:${pad2(clock[1])}:${pad2(clock[2])} UTC`
    add("GPS time", day ? `${formatDate(`${day} 00:00:00`).slice(0, 10)} ${time}` : time)
  }

  const direction = asNumber(at(0x11)?.value ?? null)
  if (direction !== null) add("Direction", `${trim(direction, 1)} degrees from ${asText(at(0x10)?.value ?? null)?.toUpperCase() === "M" ? "magnetic" : "true"} north`)

  const speed = asNumber(at(0xd)?.value ?? null)
  if (speed !== null) {
    const unit = ({ K: "km/h", M: "mph", N: "knots" } as Record<string, string>)[asText(at(0xc)?.value ?? null)?.toUpperCase() ?? "K"] ?? "km/h"
    add("Speed", `${trim(speed, 1)} ${unit}`)
  }

  add("Positioning method", decodeCharsetText(asBytes(at(0x1b)?.value ?? null), little))
  add("Place name", decodeCharsetText(asBytes(at(0x1c)?.value ?? null), little))
  return location
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function describeExif(read: ExifFields): { fields: ReportField[]; location: ReportLocation | null } {
  const little = read.byteOrder === "II"
  const out: ReportField[] = []
  let others = 0

  const known = (table: Record<number, Entry>, ignored: Set<number>, ifd: ExifField["ifd"]) => {
    for (const f of read.fields.filter((x) => x.ifd === ifd)) {
      const entry = table[f.tag]
      if (!entry) {
        if (!ignored.has(f.tag)) others++
        continue
      }
      const value = entry[2](f, little)
      if (value) out.push({ group: entry[0], label: entry[1], value, source: "EXIF" })
    }
  }
  known(IFD0, IGNORED_IFD0, "ifd0")
  known(EXIF, IGNORED_EXIF, "exif")

  // Resolution is three tags that read as one thing.
  const ifd0 = (tag: number) => read.fields.find((f) => f.ifd === "ifd0" && f.tag === tag)
  const rx = asNumber(ifd0(0x011a)?.value ?? null)
  const ry = asNumber(ifd0(0x011b)?.value ?? null)
  if (rx !== null && ry !== null) {
    const unit = asNumber(ifd0(0x0128)?.value ?? null) === 3 ? "centimetre" : "inch"
    out.push({ group: "picture", label: "Resolution", value: `${trim(rx, 1)} x ${trim(ry, 1)} pixels per ${unit}`, source: "EXIF" })
  }

  // Things that are present but not worth printing: say how big they are.
  const maker = read.fields.find((f) => f.ifd === "exif" && f.tag === 0x927c)
  if (maker) out.push({ group: "extras", label: "Camera maker notes", value: `${maker.size} bytes of private camera data`, source: "EXIF" })
  const preview = read.fields.find((f) => f.ifd === "ifd1" && f.tag === 0x0202)
  const previewPointer = read.fields.find((f) => f.ifd === "ifd1" && f.tag === 0x0201)
  if (preview || previewPointer) {
    const bytes = asNumber(preview?.value ?? null)
    out.push({ group: "extras", label: "Embedded preview image", value: bytes ? `${bytes} bytes` : "Present", source: "EXIF" })
  }
  if (others > 0) out.push({ group: "extras", label: "Other technical tags", value: `${others} ${others === 1 ? "tag" : "tags"}`, source: "EXIF" })

  const location = describeGps(
    read.fields.filter((f) => f.ifd === "gps"),
    little,
    out,
  )
  return { fields: out, location }
}
