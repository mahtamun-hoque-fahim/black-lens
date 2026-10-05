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
