// @vitest-environment node
import { describe, expect, it } from "vitest"
import { MetadataError } from "./errors"
import { assemble, buildReport, reportToText } from "./report"
import type { MetadataReport, ReportField } from "./report-types"
import { fixture } from "./test-utils"

const find = (r: MetadataReport, group: string, label: string) => r.groups.find((g) => g.id === group)?.fields.find((f) => f.label === label)
const labels = (r: MetadataReport, group: string) => r.groups.find((g) => g.id === group)?.fields.map((f) => f.label) ?? []

describe("assemble", () => {
  const f = (group: ReportField["group"], label: string, value: string, source: ReportField["source"] = "EXIF"): ReportField => ({ group, label, value, source })

  it("orders groups the way people read them and drops empty ones", () => {
    const r = assemble("jpeg", [f("extras", "A", "1"), f("author", "B", "2"), f("location", "C", "3")], null)
    expect(r.groups.map((g) => g.id)).toEqual(["location", "author", "extras"])
    expect(r.groups[0].label).toBe("Location")
  })

  it("names the source when two sources use the same label, so every label is unique", () => {
    const r = assemble("jpeg", [f("author", "Copyright", "(c) A", "EXIF"), f("author", "Copyright", "(c) A", "IPTC"), f("author", "Copyright", "(c) B", "XMP")], null)
    expect(labels(r, "author")).toEqual(["Copyright (EXIF)", "Copyright (IPTC)", "Copyright (XMP)"])
  })

  it("numbers repeats from the same source", () => {
    const r = assemble("jpeg", [f("notes", "Comment", "one", "Comment"), f("notes", "Comment", "two", "Comment")], null)
    expect(labels(r, "notes")).toEqual(["Comment", "Comment 2"])
  })

  it("removes exact duplicates", () => {
    const r = assemble("jpeg", [f("camera", "Make", "X"), f("camera", "Make", "X")], null)
    expect(labels(r, "camera")).toEqual(["Make"])
  })
})

describe("buildReport: JPEG", () => {
  it("describes the phone photo", async () => {
    const r = await buildReport(fixture("phone-gps.jpg"))
    expect(r.format).toBe("jpeg")
    expect(find(r, "location", "Coordinates")!.value).toBe("22.365067, 91.830033")
    expect(r.location!.text).toBe("22.365067, 91.830033")
    expect(find(r, "camera", "Make")!.value).toBe("FixtureCo")
    expect(find(r, "picture", "Size")).toMatchObject({ value: "32 x 32 pixels", source: "File" })
    expect(find(r, "picture", "Colour profile")!.value).toMatch(/^Embedded \(\d+ bytes\)$/)
    expect(find(r, "extras", "Embedded preview image")).toBeDefined()
  })

  it("merges EXIF, XMP, IPTC and comments from the camera photo, with sources", async () => {
    const r = await buildReport(fixture("camera-xmp-iptc.jpg"))
    expect(find(r, "author", "Artist")).toMatchObject({ value: "Fixture Photographer", source: "EXIF" })
    expect(find(r, "author", "Photographer")).toMatchObject({ source: "IPTC" })
    expect(find(r, "author", "Creator")).toMatchObject({ source: "XMP" })
    expect(find(r, "software", "Creator tool")!.value).toBe("Fixture Editor 9")
    expect(find(r, "notes", "Caption")!.value).toBe("Fixture caption text")
    expect(find(r, "notes", "Comment")).toMatchObject({ value: "Fixture comment: shot at the secret place", source: "Comment" })
    // different labels from different sources stay as they are; only a real clash gets a source suffix
    expect(labels(r, "author")).toEqual(expect.arrayContaining(["Copyright", "Copyright notice"]))
    expect(r.location).toBeNull()
  })

  it("flags data hidden after the image", async () => {
    const r = await buildReport(fixture("trailing-data.jpg"))
    expect(find(r, "extras", "Extra data after the image")!.value).toMatch(/^\d+ bytes$/)
  })

  it("has a short, true report for a photo with no metadata", async () => {
    const r = await buildReport(fixture("no-metadata.jpg"))
    expect(r.location).toBeNull()
    expect(r.groups.map((g) => g.id)).toEqual(["picture"])
  })
})

describe("buildReport: PNG", () => {
  it("reads text chunks, including compressed ones, XMP, EXIF, the time stamp and the resolution", async () => {
    const r = await buildReport(fixture("png-metadata.png"))
    expect(r.format).toBe("png")
    expect(find(r, "author", "Author")).toMatchObject({ value: "Fixture Photographer", source: "Text" })
    expect(find(r, "author", "Copyright")!.value).toBe("(c) Fixture 2026")
    expect(find(r, "software", "Software")!.value).toBe("FixtureOS 1.0")
    expect(find(r, "software", "Creator tool")).toMatchObject({ value: "Fixture Editor 9", source: "XMP" })
    expect(find(r, "notes", "Comment")!.value).toBe("Fixture comment: shot at the secret place")
    expect(find(r, "notes", "Description")!.value).toBe("Fixture caption text") // stored zlib-compressed in a zTXt chunk
    expect(find(r, "dates", "Created")!.value).toBe("2026-01-02 03:04:05")
    expect(find(r, "dates", "Last changed (PNG time stamp)")!.value).toBe("2026-01-02 03:04:05")
    expect(find(r, "camera", "Make")!.value).toBe("FixtureCo")
    expect(find(r, "location", "Coordinates")!.value).toBe("22.365067, 91.830033")
    expect(find(r, "picture", "Size")!.value).toBe("32 x 32 pixels")
    expect(find(r, "picture", "Resolution")!.value).toBe("300 x 300 pixels per inch")
    expect(find(r, "picture", "Colour profile")).toBeDefined()
  })

  it("flags trailing data and handles files with nothing", async () => {
    expect(find(await buildReport(fixture("png-trailing.png")), "extras", "Extra data after the image")).toBeDefined()
    expect((await buildReport(fixture("png-clean.png"))).groups.map((g) => g.id)).toEqual(["picture"])
  })

  it("reads a little-endian eXIf", async () => {
    expect(find(await buildReport(fixture("png-little-endian-exif.png")), "camera", "Make")!.value).toBe("LittleCo")
  })
})

describe("buildReport: WebP", () => {
  it("reads EXIF, XMP, the colour profile and names the unknown chunk", async () => {
    const r = await buildReport(fixture("webp-metadata.webp"))
    expect(r.format).toBe("webp")
    expect(find(r, "camera", "Make")!.value).toBe("FixtureCo")
    expect(find(r, "location", "Coordinates")!.value).toBe("22.365067, 91.830033")
    expect(find(r, "software", "Creator tool")!.value).toBe("Fixture Editor 9")
    expect(find(r, "picture", "Size")!.value).toBe("32 x 32 pixels")
    expect(find(r, "picture", "Colour profile")).toBeDefined()
    expect(find(r, "extras", "Unrecognised data (FXTR)")!.value).toMatch(/^\d+ bytes$/)
  })

  it("counts animation frames and reads the size of a plain file", async () => {
    expect(find(await buildReport(fixture("webp-animated.webp")), "picture", "Animation")!.value).toBe("3 frames")
    expect(find(await buildReport(fixture("webp-simple.webp")), "picture", "Size")!.value).toBe("32 x 32 pixels")
    expect(find(await buildReport(fixture("webp-lossless-alpha.webp")), "picture", "Size")!.value).toBe("32 x 32 pixels")
  })

  it("flags trailing data", async () => {
    expect(find(await buildReport(fixture("webp-trailing.webp")), "extras", "Extra data after the image")).toBeDefined()
  })
})

describe("buildReport: errors", () => {
  it("throws the same plain errors as the rest of the core", async () => {
    await expect(buildReport(fixture("corrupt-truncated.jpg"))).rejects.toMatchObject({ code: "corrupt" })
    await expect(buildReport(new Uint8Array(30).fill(3))).rejects.toMatchObject({ code: "unknown-format" })
    const heic = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0])
    await expect(buildReport(heic)).rejects.toBeInstanceOf(MetadataError)
  })
})

describe("reportToText", () => {
  it("writes the whole report as plain text a person can paste anywhere", async () => {
    const r = await buildReport(fixture("phone-gps.jpg"))
    const text = reportToText(r, "holiday.jpg")
    expect(text.split("\n")[0]).toBe("holiday.jpg")
    expect(text).toContain("\nLocation\n  Coordinates: 22.365067, 91.830033\n")
    expect(text).toContain("\nCamera\n  Make: FixtureCo\n")
    expect(text.endsWith("\n")).toBe(true)
    expect(text).not.toMatch(/—/)
  })
})
