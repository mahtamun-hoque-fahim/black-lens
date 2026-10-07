// @vitest-environment node
import { crc32 as nodeCrc32 } from "node:zlib"
import { describe, expect, it } from "vitest"
import { MetadataError } from "../errors"
import { containsText, fixture, SECRETS, toHex } from "../test-utils"
import { buildOrientationChunk, crc32 } from "./chunk"
import { inspectPng } from "./inspect"
import { extractImageData, parsePng } from "./parse"
import { stripPng } from "./strip"
import { verifyCleanPng } from "./verify"

const VALID = [
  "png-metadata.png",
  "png-palette-trns.png",
  "png-rgba.png",
  "png-little-endian-exif.png",
  "png-trailing.png",
  "png-animated.png",
  "png-clean.png",
] as const

const types = (bytes: Uint8Array) => parsePng(bytes).chunks.map((c) => c.type)

describe("crc32", () => {
  it("matches the standard check values", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926)
    expect(crc32(new TextEncoder().encode("IEND"))).toBe(0xae426082)
  })
})

describe("buildOrientationChunk", () => {
  it("writes the exact 38 bytes documented in docs/formats/png.md (expected value computed with Python zlib)", () => {
    expect(toHex(buildOrientationChunk(6))).toBe(
      "0000001a655849664d4d002a00000008000101120003000000010006000000000000d6674b69",
    )
  })
})

describe("parsePng", () => {
  it("walks a plain file: IHDR first, IEND last, nothing after", () => {
    const bytes = fixture("png-clean.png")
    const png = parsePng(bytes)
    expect(png.chunks[0].type).toBe("IHDR")
    expect(png.chunks[png.chunks.length - 1].type).toBe("IEND")
    expect(png.chunks.some((c) => c.type === "IDAT")).toBe(true)
    expect(png.endOffset).toBe(bytes.length)
    expect(png.trailingBytes).toBe(0)
  })

  it("sees the animation chunks of an APNG", () => {
    expect(types(fixture("png-animated.png"))).toEqual(expect.arrayContaining(["acTL", "fcTL", "fdAT"]))
  })

  it("measures bytes after IEND as trailing data", () => {
    const png = parsePng(fixture("png-trailing.png"))
    expect(png.endOffset).toBe(fixture("png-metadata.png").length)
    expect(png.trailingBytes).toBeGreaterThan(200)
  })

  it("rejects truncated, non-PNG and unknown-critical files as corrupt", () => {
    for (const bad of [fixture("png-corrupt.png"), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), fixture("png-unknown-critical.png")]) {
      try {
        parsePng(bad)
        expect.unreachable("should have thrown")
      } catch (e) {
        expect(e).toBeInstanceOf(MetadataError)
        expect((e as MetadataError).code).toBe("corrupt")
      }
    }
  })
})

describe("inspectPng (the reader)", () => {
  it("finds EXIF tags, text keywords, XMP, time and the colour profile", () => {
    const info = inspectPng(fixture("png-metadata.png"))
    const has = (ifd: string, tag: number) => info.exif!.entries.some((e) => e.ifd === ifd && e.tag === tag)
    expect(info.orientation).toBe(6)
    expect(has("ifd0", 0x010f)).toBe(true) // Make
    expect(has("exif", 0xa431)).toBe(true) // BodySerialNumber
    expect(has("gps", 0x0002)).toBe(true) // GPSLatitude
    expect(info.textKeywords).toEqual(
      expect.arrayContaining(["Author", "Software", "Copyright", "Comment", "Description", "XML:com.adobe.xmp", "Creation Time"]),
    )
    expect(info.xmp).toBe(true)
    expect(info.time).toBe(true)
    expect(info.icc).toBe(true)
  })

  it("reads a little-endian eXIf chunk", () => {
    const info = inspectPng(fixture("png-little-endian-exif.png"))
    expect(info.exif!.byteOrder).toBe("II")
    expect(info.orientation).toBe(8)
    expect(info.exif!.entries.some((e) => e.ifd === "gps")).toBe(true)
  })

  it("reports a file with no metadata as having none", () => {
    const info = inspectPng(fixture("png-clean.png"))
    expect(info.exif).toBeNull()
    expect(info.textKeywords).toEqual([])
    expect(info.xmp || info.time || info.icc).toBe(false)
  })
})

describe("stripPng", () => {
  describe.each(VALID)("%s", (name) => {
    const input = fixture(name)
    const result = stripPng(input)

    it("leaves no identifying metadata when re-read", () => {
      const check = verifyCleanPng(result.bytes)
      expect(check.findings).toEqual([])
      expect(check.clean).toBe(true)
    })

    it("leaves none of the injected text anywhere in the bytes", () => {
      for (const secret of SECRETS) expect(containsText(result.bytes, secret), `found "${secret}"`).toBe(false)
    })

    it("keeps the image data byte for byte", () => {
      expect(toHex(extractImageData(result.bytes))).toBe(toHex(extractImageData(input)))
    })

    it("ends exactly at IEND with nothing after it", () => {
      expect(types(result.bytes).at(-1)).toBe("IEND")
      expect(inspectPng(result.bytes).trailingBytes).toBe(0)
    })

    it("writes a correct CRC on every chunk (checked with Node's own crc32)", () => {
      for (const c of parsePng(result.bytes).chunks) {
        const body = result.bytes.subarray(c.offset + 4, c.dataEnd) // type + data
        const stored = new DataView(result.bytes.buffer, result.bytes.byteOffset + c.dataEnd, 4).getUint32(0)
        expect(stored, `bad CRC on ${c.type}`).toBe(nodeCrc32(body))
      }
    })

    it("keeps the Orientation value the original had", () => {
      expect(inspectPng(result.bytes).orientation).toBe(inspectPng(input).orientation)
    })

    it("is idempotent: cleaning a clean file changes nothing", () => {
      expect(toHex(stripPng(result.bytes).bytes)).toBe(toHex(result.bytes))
    })

    it("does not modify its input", () => {
      const copy = fixture(name)
      stripPng(copy)
      expect(toHex(copy)).toBe(toHex(input))
    })
  })

  it("leaves exactly one EXIF tag (Orientation), placed right after IHDR", () => {
    const out = stripPng(fixture("png-metadata.png")).bytes
    expect(inspectPng(out).exif!.entries).toEqual([{ ifd: "ifd0", tag: 0x0112 }])
    expect(types(out)[1]).toBe("eXIf")
  })

  it("writes no eXIf chunk when the original had no Orientation", () => {
    expect(types(stripPng(fixture("png-rgba.png")).bytes)).not.toContain("eXIf")
  })

  it("passes an already clean file through unchanged", () => {
    const input = fixture("png-clean.png")
    expect(toHex(stripPng(input).bytes)).toBe(toHex(input))
  })

  it("keeps the chunks a viewer needs to show the image correctly", () => {
    const meta = types(stripPng(fixture("png-metadata.png")).bytes)
    expect(meta).toEqual(expect.arrayContaining(["gAMA", "pHYs", "iCCP"]))
    expect(types(stripPng(fixture("png-palette-trns.png")).bytes)).toEqual(expect.arrayContaining(["PLTE", "tRNS"]))
    expect(types(stripPng(fixture("png-animated.png")).bytes)).toEqual(expect.arrayContaining(["acTL", "fcTL", "fdAT"]))
  })

  it("removes text, time and EXIF chunks", () => {
    const out = types(stripPng(fixture("png-metadata.png")).bytes)
    for (const gone of ["tEXt", "zTXt", "iTXt", "tIME"]) expect(out).not.toContain(gone)
  })

  it("removes the colour profile when asked, and is still clean", () => {
    const result = stripPng(fixture("png-metadata.png"), { removeIcc: true })
    expect(types(result.bytes)).not.toContain("iCCP")
    expect(verifyCleanPng(result.bytes, { removeIcc: true }).clean).toBe(true)
    expect(result.removed.some((r) => r.kind === "icc")).toBe(true)
  })

  it("reports what it removed and what it kept", () => {
    const meta = stripPng(fixture("png-metadata.png"))
    expect(meta.removed.map((r) => r.kind)).toEqual(expect.arrayContaining(["exif", "text", "modified-time"]))
    expect(meta.kept.some((k) => k.kind === "orientation")).toBe(true)
    expect(meta.kept.some((k) => k.kind === "icc")).toBe(true)
    expect(stripPng(fixture("png-trailing.png")).removed.some((r) => r.kind === "trailing-data")).toBe(true)
  })

  it("throws on corrupt or unknown-critical files instead of returning a half-cleaned one", () => {
    expect(() => stripPng(fixture("png-corrupt.png"))).toThrowError(MetadataError)
    expect(() => stripPng(fixture("png-unknown-critical.png"))).toThrowError(MetadataError)
  })
})

describe("verifyCleanPng (the check must be able to fail)", () => {
  it("flags dirty files", () => {
    for (const name of ["png-metadata.png", "png-palette-trns.png", "png-rgba.png", "png-trailing.png", "png-animated.png"]) {
      expect(verifyCleanPng(fixture(name)).clean, name).toBe(false)
    }
  })

  it("flags an ICC profile only when removal was requested", () => {
    const clean = stripPng(fixture("png-metadata.png")).bytes
    expect(verifyCleanPng(clean).clean).toBe(true)
    expect(verifyCleanPng(clean, { removeIcc: true }).clean).toBe(false)
  })
})
