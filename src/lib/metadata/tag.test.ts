// @vitest-environment node
import { crc32 as nodeCrc32 } from "node:zlib"
import { describe, expect, it } from "vitest"
import { readExifFields } from "./exif"
import { inspectJpeg } from "./jpeg/inspect"
import { jpegParts } from "./jpeg/parts"
import { buildReport, MetadataError, tagMetadata } from "./index"
import { inspectPng } from "./png/inspect"
import { parsePng } from "./png/parse"
import { inspectWebp } from "./webp/inspect"
import { webpParts } from "./webp/parts"
import { containsText, fixture, SECRETS } from "./test-utils"
import type { MetadataReport } from "./report-types"
import { normalizeTags } from "./tags"

const FULL = {
  artist: "Fahim Hoque",
  copyright: "(c) 2026 Fahim Hoque. All rights reserved.",
  title: "Harbour at dusk",
  description: "Evening light over the harbour.\nTaken on the pier.",
  keywords: "sea, boats, evening",
  date: "2026-01-02",
}

const JPEGS = ["phone-gps.jpg", "camera-xmp-iptc.jpg", "progressive.jpg", "no-metadata.jpg", "trailing-data.jpg", "cmyk-adobe.jpg", "little-endian.jpg", "wide.jpg"]
const PNGS = ["png-metadata.png", "png-palette-trns.png", "png-rgba.png", "png-little-endian-exif.png", "png-trailing.png", "png-animated.png", "png-clean.png", "wide.png"]
const WEBPS = [
  "webp-metadata.webp", "webp-lossless-alpha.webp", "webp-alpha-lossy.webp", "webp-simple.webp", "webp-animated.webp", "webp-trailing.webp",
  "webp-little-endian-exif.webp", "webp-reserved-bits.webp", "webp-pad-bytes.webp", "wide-lossy.webp", "wide-lossless.webp", "wide-extended.webp", "wide-lossless-alpha-simple.webp",
]
const ALL = [...JPEGS, ...PNGS, ...WEBPS]

const values = (r: MetadataReport, group: string) => r.groups.find((g) => g.id === group)?.fields.map((f) => f.value) ?? []
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex")
const orientationOf = (name: string, bytes: Uint8Array) => (name.endsWith(".jpg") ? inspectJpeg(bytes) : name.endsWith(".png") ? inspectPng(bytes) : inspectWebp(bytes)).orientation

describe.each(ALL)("tagMetadata: %s", (name) => {
  const input = fixture(name)

  it("cleans, writes the six fields and proves it", async () => {
    const r = await tagMetadata(input, FULL)
    expect(r.verification).toEqual({ clean: true, imageDataIdentical: true, tagsReadBack: true, findings: [] })
    expect(r.written.map((w) => w.label)).toEqual(["Artist", "Copyright", "Title", "Description", "Keywords", "Date"])
  })

  it("leaves nothing but the tagged values, no location, nothing hidden", async () => {
    const report = await buildReport((await tagMetadata(input, FULL)).bytes)
    expect(report.location).toBeNull()
    expect(values(report, "author")).toEqual(expect.arrayContaining([FULL.artist, FULL.copyright]))
    expect(values(report, "notes")).toEqual(expect.arrayContaining([FULL.title, FULL.description, "sea, boats, evening"]))
    expect(values(report, "dates").some((v) => v.startsWith("2026-01-02"))).toBe(true)
    for (const g of ["location", "camera", "software", "extras"]) expect(values(report, g), g).toEqual([])
  })

  it("keeps none of the original's identifying text", async () => {
    const out = (await tagMetadata(input, FULL)).bytes
    for (const secret of [...SECRETS, "FXTR", "FixtureOS unknown"]) expect(containsText(out, secret), `found "${secret}"`).toBe(false)
  })

  it("keeps the Orientation the photo had", async () => {
    expect(orientationOf(name, (await tagMetadata(input, FULL)).bytes)).toBe(orientationOf(name, input))
  })

  it("is idempotent: tagging a tagged photo with the same fields changes nothing", async () => {
    const once = (await tagMetadata(input, FULL)).bytes
    expect(hex((await tagMetadata(once, FULL)).bytes)).toBe(hex(once))
  })
})

describe("tagMetadata: what it asks for", () => {
  it("writes only the fields that were filled in", async () => {
    const r = await tagMetadata(fixture("phone-gps.jpg"), { artist: "Fahim" })
    expect(r.written).toEqual([{ label: "Artist", value: "Fahim" }])
    const report = await buildReport(r.bytes)
    expect(values(report, "notes")).toEqual([])
    expect(values(report, "dates")).toEqual([])
  })

  it("rejects an empty form and invalid fields with a plain error before touching the file", async () => {
    await expect(tagMetadata(fixture("phone-gps.jpg"), {})).rejects.toMatchObject({ code: "invalid-tags", message: "Fill in at least one field." })
    await expect(tagMetadata(fixture("phone-gps.jpg"), { date: "2026-02-30" })).rejects.toMatchObject({ code: "invalid-tags", message: "Date must be a real date, like 2026-01-02." })
    await expect(tagMetadata(fixture("phone-gps.jpg"), { artist: "x".repeat(201) })).rejects.toMatchObject({ code: "invalid-tags" })
  })

  it("throws the same plain errors as Clean for broken and unsupported files", async () => {
    await expect(tagMetadata(fixture("corrupt-truncated.jpg"), FULL)).rejects.toMatchObject({ code: "corrupt" })
    const heic = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0])
    await expect(tagMetadata(heic, FULL)).rejects.toBeInstanceOf(MetadataError)
  })

  it("passes removeIcc through", async () => {
    expect(inspectJpeg((await tagMetadata(fixture("phone-gps.jpg"), FULL, { removeIcc: true })).bytes).icc).toBe(false)
    expect(inspectJpeg((await tagMetadata(fixture("phone-gps.jpg"), FULL)).bytes).icc).toBe(true)
  })

  it("does not modify its input", async () => {
    const copy = fixture("phone-gps.jpg")
    await tagMetadata(copy, FULL)
    expect(hex(copy)).toBe(hex(fixture("phone-gps.jpg")))
  })
})

describe("tagMetadata: text that is not plain ASCII", () => {
  const bengali = "\u09ab\u09be\u09b9\u09bf\u09ae \u09b9\u0995"

  it("writes it to XMP, leaves it out of EXIF, and reads back exactly", async () => {
    const out = (await tagMetadata(fixture("phone-gps.jpg"), { artist: bengali, copyright: "(c) 2026 Fahim" })).bytes
    const report = await buildReport(out)
    expect(values(report, "author")).toEqual(expect.arrayContaining([bengali]))
    const exif = readExifFields(jpegParts(out).exif!)!.fields
    expect(exif.find((f) => f.tag === 0x013b)).toBeUndefined() // not ASCII, so not in EXIF
    expect(exif.find((f) => f.tag === 0x8298)?.value).toBe("(c) 2026 Fahim") // ASCII, so mirrored
  })

  it("survives text built to break XML", async () => {
    const hostile = { artist: "A & B <i>", description: "]]></rdf:li><x:evil/>\n\"quoted\" 'single'", title: "<?xpacket end='w'?>" }
    const out = (await tagMetadata(fixture("png-clean.png"), hostile)).bytes
    const report = await buildReport(out)
    expect(values(report, "author")).toContain(normalizeTags(hostile).tags.artist)
    expect(values(report, "notes")).toEqual(expect.arrayContaining([normalizeTags(hostile).tags.description, normalizeTags(hostile).tags.title]))
  })
})

describe("tagMetadata: JPEG layout", () => {
  it("puts EXIF then XMP right after the JFIF header, and touches nothing else", async () => {
    const out = (await tagMetadata(fixture("phone-gps.jpg"), FULL)).bytes
    const names = inspectJpeg(out).segments.map((s) => (s.signature ? `${s.name}:${s.signature}` : s.name))
    expect(names.slice(0, 5)).toEqual(["SOI", "APP0:JFIF", "APP1:Exif", "APP1:XMP", "APP2:ICC_PROFILE"])
    expect(inspectJpeg(out).segments.every((s) => s.size <= 65537)).toBe(true)
  })

  it("mirrors the ASCII fields into EXIF and the date at midnight", async () => {
    const f = readExifFields(jpegParts((await tagMetadata(fixture("phone-gps.jpg"), FULL)).bytes).exif!)!.fields
    expect(f.find((x) => x.tag === 0x013b)?.value).toBe(FULL.artist)
    expect(f.find((x) => x.tag === 0x9003)?.value).toBe("2026:01:02 00:00:00")
    expect(f.find((x) => x.tag === 0x0112)?.value).toBe(6)
  })
})

describe("tagMetadata: PNG layout", () => {
  it("writes eXIf, then the text chunks and XMP, right after IHDR, each with a correct CRC", async () => {
    const out = (await tagMetadata(fixture("png-metadata.png"), FULL)).bytes
    const png = parsePng(out)
    expect(png.chunks.slice(0, 2).map((c) => c.type)).toEqual(["IHDR", "eXIf"])
    const info = inspectPng(out)
    expect(info.textKeywords).toEqual(["Author", "Copyright", "Title", "Description", "Creation Time", "XML:com.adobe.xmp"])
    expect(png.chunks.filter((c) => c.type === "iTXt")).toHaveLength(6)
    for (const c of png.chunks) {
      const stored = new DataView(out.buffer, out.byteOffset + c.dataEnd, 4).getUint32(0)
      expect(stored, `CRC of ${c.type}`).toBe(nodeCrc32(out.subarray(c.offset + 4, c.dataEnd)))
    }
  })
})

describe("tagMetadata: WebP layout", () => {
  const flags = (b: Uint8Array) => inspectWebp(b).flags!

  it("gives a simple file an extended header with the right canvas and flags", async () => {
    const out = (await tagMetadata(fixture("wide-lossy.webp"), FULL)).bytes
    const info = inspectWebp(out)
    expect(info.chunks.map((c) => c.type)).toEqual(["VP8X", "VP8 ", "EXIF", "XMP "])
    expect(flags(out)).toBe(0x08 | 0x04) // EXIF and XMP; no alpha, no profile
    expect(webpParts(out).size).toEqual({ width: 48, height: 16 })
  })

  it("reads the alpha flag from inside a lossless file that has no header", async () => {
    const out = (await tagMetadata(fixture("wide-lossless-alpha-simple.webp"), FULL)).bytes
    expect(flags(out) & 0x10).toBe(0x10)
    expect(webpParts(out).size).toEqual({ width: 48, height: 16 })
    // and a lossless file without transparency does not get the flag
    expect(flags((await tagMetadata(fixture("wide-lossless.webp"), FULL)).bytes) & 0x10).toBe(0)
  })

  it("keeps the colour profile, alpha and animation flags of an extended file", async () => {
    expect(flags((await tagMetadata(fixture("webp-metadata.webp"), FULL)).bytes) & 0x20).toBe(0x20)
    expect(flags((await tagMetadata(fixture("webp-alpha-lossy.webp"), FULL)).bytes) & 0x10).toBe(0x10)
    expect(flags((await tagMetadata(fixture("webp-animated.webp"), FULL)).bytes) & 0x02).toBe(0x02)
  })

  it("omits the EXIF chunk and flag when EXIF has nothing to hold", async () => {
    const out = (await tagMetadata(fixture("wide-lossy.webp"), { title: "Only a title", keywords: "a" })).bytes
    expect(inspectWebp(out).chunks.map((c) => c.type)).toEqual(["VP8X", "VP8 ", "XMP "])
    expect(flags(out)).toBe(0x04)
  })

  it("keeps the RIFF size honest and the length even", async () => {
    const out = (await tagMetadata(fixture("wide-lossless-alpha-simple.webp"), FULL)).bytes
    expect(new DataView(out.buffer, out.byteOffset).getUint32(4, true)).toBe(out.length - 8)
    expect(out.length % 2).toBe(0)
  })
})
