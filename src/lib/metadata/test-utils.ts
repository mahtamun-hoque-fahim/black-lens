import { readFileSync } from "node:fs"
import { join } from "node:path"
import { appSignature, parseJpeg } from "./jpeg/parse"

const FIXTURE_DIR = join(process.cwd(), "src", "lib", "metadata", "__fixtures__")

/** Load a fixture as a plain Uint8Array (not a Buffer), the same type the browser gives us. */
export function fixture(name: string): Uint8Array {
  const buf = readFileSync(join(FIXTURE_DIR, name))
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice()
}

/** True if the bytes contain this text anywhere. A blunt "grep" check, independent of any parser. */
export function containsText(bytes: Uint8Array, text: string): boolean {
  return Buffer.from(bytes).includes(Buffer.from(text, "utf8"))
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/** Text injected into fixtures by scripts/make-fixtures.py that must never survive Clean. */
export const SECRETS = [
  "FixtureCo",
  "FixtureCam",
  "LittleCo",
  "Fixture Phone",
  "FixtureOS",
  "SN-0000-PHONE",
  "Fixture Photographer",
  "(c) Fixture",
  "Fixture Editor",
  "secret place",
  "2026:01:02",
  "ftypmp42",
  "xmpmeta",
]

/** The bare TIFF block of a JPEG fixture's EXIF segment (after "Exif\0\0"), or null. */
export function exifTiff(name: string): Uint8Array | null {
  const bytes = fixture(name)
  const parsed = parseJpeg(bytes)
  const seg = parsed.segments.find((s) => appSignature(bytes, s) === "Exif")
  return seg ? bytes.subarray(seg.dataStart + 6, seg.dataEnd) : null
}
