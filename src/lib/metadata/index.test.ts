// @vitest-environment node
import { describe, expect, it } from "vitest"
import { MetadataError } from "./errors"
import { stripMetadata } from "./index"
import { fixture } from "./test-utils"

describe("stripMetadata", () => {
  it("cleans a JPEG and reports a verified result", () => {
    const result = stripMetadata(fixture("phone-gps.jpg"))
    expect(result.format).toBe("jpeg")
    expect(result.verification.clean).toBe(true)
    expect(result.verification.imageDataIdentical).toBe(true)
    expect(result.bytes.length).toBeLessThan(fixture("phone-gps.jpg").length)
  })

  it("cleans a PNG and reports a verified result", () => {
    const input = fixture("png-metadata.png")
    const result = stripMetadata(input)
    expect(result.format).toBe("png")
    expect(result.verification.clean).toBe(true)
    expect(result.verification.imageDataIdentical).toBe(true)
    expect(result.bytes.length).toBeLessThan(input.length)
  })

  it("honours removeIcc for PNG", () => {
    const result = stripMetadata(fixture("png-metadata.png"), { removeIcc: true })
    expect(result.removed.some((r) => r.kind === "icc")).toBe(true)
  })

  it("says WebP is not supported yet, by name", () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0])
    try {
      stripMetadata(webp)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect((e as MetadataError).code).toBe("unsupported")
      expect((e as MetadataError).message).toBe("WebP cleaning is not supported yet.")
    }
  })

  it("says HEIC is not supported yet", () => {
    const heic = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0])
    try {
      stripMetadata(heic)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(MetadataError)
      expect((e as MetadataError).code).toBe("unsupported")
    }
  })

  it("rejects bytes that are not an image at all", () => {
    try {
      stripMetadata(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))
      expect.unreachable("should have thrown")
    } catch (e) {
      expect((e as MetadataError).code).toBe("unknown-format")
    }
  })

  it("rejects a corrupt JPEG", () => {
    try {
      stripMetadata(fixture("corrupt-truncated.jpg"))
      expect.unreachable("should have thrown")
    } catch (e) {
      expect((e as MetadataError).code).toBe("corrupt")
    }
  })
})
