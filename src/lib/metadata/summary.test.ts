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

  it("reads GPS from a little-endian file", () => {
    expect(summarizeMetadata(fixture("little-endian.jpg")).location).toBe(true)
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
})
