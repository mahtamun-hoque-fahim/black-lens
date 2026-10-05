// @vitest-environment node
import { describe, expect, it } from "vitest"
import { sniffFormat } from "./sniff"
import { fixture } from "./test-utils"

const bytes = (...n: number[]) => new Uint8Array(n)

describe("sniffFormat", () => {
  it("recognises JPEG by its magic bytes", () => {
    expect(sniffFormat(fixture("phone-gps.jpg"))).toBe("jpeg")
    expect(sniffFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg")
  })

  it("recognises PNG by its 8-byte signature", () => {
    expect(sniffFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("png")
  })

  it("recognises WebP: RIFF, 4 size bytes, then WEBP", () => {
    const webp = bytes(0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)
    expect(sniffFormat(webp)).toBe("webp")
  })

  it("recognises HEIC so the UI can say 'not supported yet'", () => {
    // 4 size bytes, "ftyp", then a HEIF brand
    const heic = bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63)
    expect(sniffFormat(heic)).toBe("heic")
  })

  it("does not confuse a RIFF file that is not WebP (a WAV)", () => {
    const wav = bytes(0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)
    expect(sniffFormat(wav)).toBe("unknown")
  })

  it("returns unknown for empty, tiny, or random input", () => {
    expect(sniffFormat(new Uint8Array(0))).toBe("unknown")
    expect(sniffFormat(bytes(0xff))).toBe("unknown")
    expect(sniffFormat(bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12))).toBe("unknown")
  })
})
