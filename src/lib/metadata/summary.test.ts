// @vitest-environment node
import { describe, expect, it } from "vitest"
import { MetadataError } from "./errors"
import { summarizeMetadata } from "./index"
import { fixture } from "./test-utils"

describe("summarizeMetadata", () => {
  it("flags location, camera, dates and software in the phone photo", () => {
    const s = summarizeMetadata(fixture("phone-gps.jpg"))
    expect(s).toMatchObject({
      format: "jpeg",
      location: true,
      camera: true,
      dates: true,
      software: true,
      preview: true,
      colourProfile: true,
      orientation: 6,
      alreadyClean: false,
    })
  })

  it("flags author, notes and camera serials in the camera photo, but no location", () => {
    const s = summarizeMetadata(fixture("camera-xmp-iptc.jpg"))
    expect(s.author).toBe(true)
    expect(s.notes).toBe(true) // XMP, IPTC and a comment
    expect(s.camera).toBe(true)
    expect(s.location).toBe(false)
    expect(s.alreadyClean).toBe(false)
  })

  it("flags extra data attached after the image", () => {
    expect(summarizeMetadata(fixture("trailing-data.jpg")).extraData).toBe(true)
    expect(summarizeMetadata(fixture("phone-gps.jpg")).extraData).toBe(false)
  })

  it("does not call a GPS section with no coordinates a location (phones with location off write one)", () => {
    // little-endian.jpg has a GPS section holding only a latitude reference letter
    const s = summarizeMetadata(fixture("little-endian.jpg"))
    expect(s.location).toBe(false)
    expect(s.alreadyClean).toBe(false) // it still carries metadata Clean will remove
    expect(s.camera).toBe(true)
  })

  it("still calls it a location when the coordinates are there, even if they cannot be read", () => {
    expect(summarizeMetadata(fixture("phone-gps.jpg")).location).toBe(true)
    expect(summarizeMetadata(fixture("png-metadata.png")).location).toBe(true)
    expect(summarizeMetadata(fixture("webp-metadata.webp")).location).toBe(true)
  })

  it("agrees across formats: the little-endian PNG and WebP are not locations either", () => {
    expect(summarizeMetadata(fixture("png-little-endian-exif.png")).location).toBe(false)
    expect(summarizeMetadata(fixture("webp-little-endian-exif.webp")).location).toBe(false)
  })

  it("says a file with nothing identifying is already clean", () => {
    const s = summarizeMetadata(fixture("no-metadata.jpg"))
    expect(s.alreadyClean).toBe(true)
    expect(s.location || s.camera || s.dates || s.software || s.author || s.notes || s.preview || s.extraData).toBe(false)
  })

  it("treats a file we already cleaned as already clean", async () => {
    const { stripMetadata } = await import("./index")
    const cleaned = stripMetadata(fixture("phone-gps.jpg")).bytes
    const s = summarizeMetadata(cleaned)
    expect(s.alreadyClean).toBe(true)
    expect(s.orientation).toBe(6)
    expect(s.colourProfile).toBe(true)
  })

  it("throws the same errors as stripMetadata for unsupported and broken files", () => {
    expect(() => summarizeMetadata(fixture("corrupt-truncated.jpg"))).toThrowError(MetadataError)
    const heic = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0])
    expect(() => summarizeMetadata(heic)).toThrowError(MetadataError)
  })

  describe("PNG", () => {
    it("flags location, camera, dates, software, author and notes in the metadata PNG", () => {
      expect(summarizeMetadata(fixture("png-metadata.png"))).toMatchObject({
        format: "png",
        location: true,
        camera: true,
        dates: true,
        software: true,
        author: true,
        notes: true,
        colourProfile: true,
        orientation: 6,
        alreadyClean: false,
      })
    })

    it("reads software from a plain text chunk", () => {
      const s = summarizeMetadata(fixture("png-rgba.png"))
      expect(s.software).toBe(true)
      expect(s.location).toBe(false)
      expect(s.alreadyClean).toBe(false)
    })

    it("flags extra data after IEND", () => {
      expect(summarizeMetadata(fixture("png-trailing.png")).extraData).toBe(true)
    })

    it("says a PNG with no metadata is already clean", () => {
      expect(summarizeMetadata(fixture("png-clean.png")).alreadyClean).toBe(true)
    })
  })

  describe("WebP", () => {
    it("flags location, camera, notes and the colour profile in the metadata WebP", () => {
      expect(summarizeMetadata(fixture("webp-metadata.webp"))).toMatchObject({
        format: "webp",
        location: true,
        camera: true,
        dates: true,
        notes: true, // XMP
        colourProfile: true,
        orientation: 6,
        alreadyClean: false,
      })
    })

    it("calls an unknown chunk 'other' when nothing else is named", () => {
      expect(summarizeMetadata(fixture("webp-reserved-bits.webp")).alreadyClean).toBe(false)
    })

    it("flags extra data after the RIFF size", () => {
      expect(summarizeMetadata(fixture("webp-trailing.webp")).extraData).toBe(true)
    })

    it("says a simple WebP is already clean", () => {
      expect(summarizeMetadata(fixture("webp-simple.webp")).alreadyClean).toBe(true)
    })
  })
})
