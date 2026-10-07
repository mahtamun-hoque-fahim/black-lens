// @vitest-environment node
import { describe, expect, it } from "vitest"
import { MetadataError, type MetadataSummary } from "@/lib/metadata"
import { cleanFileName, errorMessage, formatBytes, foundItems, keptLabel, removedLabel } from "./clean-file"

const base: MetadataSummary = {
  format: "jpeg", location: false, camera: false, dates: false, software: false, author: false,
  notes: false, preview: false, extraData: false, other: false, colourProfile: false,
  orientation: null, alreadyClean: false,
}

describe("cleanFileName", () => {
  it("adds -clean before the extension and keeps the extension", () => {
    expect(cleanFileName("holiday.jpg")).toBe("holiday-clean.jpg")
    expect(cleanFileName("IMG_0042.JPEG")).toBe("IMG_0042-clean.JPEG")
    expect(cleanFileName("my.trip.photo.jpg")).toBe("my.trip.photo-clean.jpg")
  })
  it("falls back to .jpg when there is no extension", () => {
    expect(cleanFileName("photo")).toBe("photo-clean.jpg")
    expect(cleanFileName("")).toBe("photo-clean.jpg")
  })
})

describe("formatBytes", () => {
  it("uses B, KB and MB with one decimal where useful", () => {
    expect(formatBytes(812)).toBe("812 B")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(2_411_724)).toBe("2.3 MB")
  })
})

describe("foundItems", () => {
  it("names only the categories that are present, in plain words", () => {
    expect(foundItems({ ...base, location: true, camera: true })).toEqual([
      "Where the photo was taken",
      "Camera make, model or serial numbers",
    ])
    expect(foundItems(base)).toEqual([])
  })
  it("never uses jargon or em dashes", () => {
    const all = foundItems({ ...base, location: true, camera: true, dates: true, software: true, author: true, notes: true, preview: true, extraData: true, other: true }).join(" ")
    expect(all).not.toMatch(/—|EXIF|XMP|IPTC|APP1/)
  })
})

describe("removedLabel and keptLabel", () => {
  it("describe every kind in plain words", () => {
    for (const kind of ["exif", "xmp", "iptc", "comment", "text", "modified-time", "jfif-thumbnail", "trailing-data", "icc", "other-segment"] as const) {
      expect(removedLabel(kind).length).toBeGreaterThan(5)
    }
    expect(keptLabel({ kind: "orientation", value: 6 })).toMatch(/rotation/i)
    expect(keptLabel({ kind: "icc", bytes: 10 })).toMatch(/colour/i)
    expect(keptLabel({ kind: "structure" })).toMatch(/needs/i)
  })
})

describe("errorMessage", () => {
  it("maps each error code to a plain sentence", () => {
    expect(errorMessage(new MetadataError("corrupt", "x"))).toMatch(/damaged/i)
    expect(errorMessage(new MetadataError("unknown-format", "x"))).toMatch(/JPEG, PNG or WebP/)
    expect(errorMessage(new MetadataError("verification-failed", "x"))).toMatch(/original is untouched/i)
    expect(errorMessage(new MetadataError("unsupported", "PNG cleaning is not supported yet."))).toBe("PNG cleaning is not supported yet.")
  })
  it("handles surprises without leaking internals", () => {
    expect(errorMessage(new Error("boom stack"))).toBe("Something went wrong while reading this file. Nothing was changed.")
    expect(errorMessage("weird")).toBe("Something went wrong while reading this file. Nothing was changed.")
  })
})
