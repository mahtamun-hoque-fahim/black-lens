// @vitest-environment node
import { describe, expect, it } from "vitest"
import { MetadataError } from "../errors"
import { containsText, fixture, SECRETS, toHex } from "../test-utils"
import { buildOrientationExifChunk } from "./chunk"
import { inspectWebp } from "./inspect"
import { extractImageData, parseWebp } from "./parse"
import { stripWebp } from "./strip"
import { verifyCleanWebp } from "./verify"

const VALID = [
  "webp-metadata.webp",
  "webp-lossless-alpha.webp",
  "webp-alpha-lossy.webp",
  "webp-simple.webp",
  "webp-animated.webp",
  "webp-trailing.webp",
  "webp-little-endian-exif.webp",
  "webp-reserved-bits.webp",
  "webp-pad-bytes.webp",
] as const

const WEBP_SECRETS = [...SECRETS, "FXTR", "FixtureOS unknown"]
const types = (bytes: Uint8Array) => parseWebp(bytes).chunks.map((c) => c.type)
const flagsOf = (bytes: Uint8Array) => inspectWebp(bytes).flags
const le32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(at, true)

describe("buildOrientationExifChunk", () => {
  it("writes the exact 34 bytes documented in docs/formats/webp.md", () => {
    expect(toHex(buildOrientationExifChunk(6))).toBe(
      "45584946" + "1a000000" + "4d4d002a00000008000101120003000000010006000000000000",
    )
  })
})

describe("parseWebp", () => {
  it("walks a simple file: one image chunk, nothing after", () => {
    const bytes = fixture("webp-simple.webp")
    const webp = parseWebp(bytes)
    expect(webp.chunks.map((c) => c.type)).toEqual(["VP8 "])
    expect(webp.riffEnd).toBe(bytes.length)
    expect(webp.trailingBytes).toBe(0)
  })

  it("walks an extended file in order", () => {
    expect(types(fixture("webp-metadata.webp"))).toEqual(["VP8X", "ICCP", "VP8 ", "EXIF", "XMP ", "FXTR"])
  })

  it("sees animation frames", () => {
    const t = types(fixture("webp-animated.webp"))
    expect(t.filter((x) => x === "ANMF")).toHaveLength(3)
    expect(t).toEqual(expect.arrayContaining(["VP8X", "ANIM"]))
  })

  it("measures bytes after the RIFF size as trailing data", () => {
    const webp = parseWebp(fixture("webp-trailing.webp"))
    expect(webp.riffEnd).toBe(fixture("webp-metadata.webp").length)
    expect(webp.trailingBytes).toBeGreaterThan(200)
  })

  it("rejects truncated, non-WebP, and size-lying files as corrupt", () => {
    const lying = fixture("webp-simple.webp")
    new DataView(lying.buffer).setUint32(4, lying.length + 100, true) // RIFF size larger than the file
    for (const bad of [fixture("webp-corrupt.webp"), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]), lying]) {
      try {
        parseWebp(bad)
        expect.unreachable("should have thrown")
      } catch (e) {
        expect(e).toBeInstanceOf(MetadataError)
        expect((e as MetadataError).code).toBe("corrupt")
      }
    }
  })
})

describe("inspectWebp (the reader)", () => {
  it("finds EXIF tags, XMP, the colour profile, flags and an unknown chunk", () => {
    const info = inspectWebp(fixture("webp-metadata.webp"))
    const has = (ifd: string, tag: number) => info.exif!.entries.some((e) => e.ifd === ifd && e.tag === tag)
    expect(info.orientation).toBe(6)
    expect(has("ifd0", 0x010f)).toBe(true)
    expect(has("gps", 0x0002)).toBe(true)
    expect(info.xmp).toBe(true)
    expect(info.icc).toBe(true)
    expect(info.unknownChunks).toEqual(["FXTR"])
    expect(info.flags! & 0x2c).toBe(0x2c) // ICC, EXIF, XMP
  })

  it("reads a little-endian EXIF chunk", () => {
    const info = inspectWebp(fixture("webp-little-endian-exif.webp"))
    expect(info.exif!.byteOrder).toBe("II")
    expect(info.orientation).toBe(8)
  })

  it("finds an unknown chunk hidden inside an animation frame", () => {
    const info = inspectWebp(fixture("webp-animated.webp"))
    expect(info.animated).toBe(true)
    expect(info.unknownFrameChunks).toBe(1)
  })

  it("notices reserved bits used to hide data", () => {
    expect(inspectWebp(fixture("webp-reserved-bits.webp")).reservedBitsSet).toBe(true)
    expect(inspectWebp(fixture("webp-metadata.webp")).reservedBitsSet).toBe(false)
  })

  it("reports a simple file as having nothing", () => {
    const info = inspectWebp(fixture("webp-simple.webp"))
    expect(info.flags).toBeNull()
    expect(info.exif).toBeNull()
    expect(info.xmp || info.icc).toBe(false)
  })
})

describe("stripWebp", () => {
  describe.each(VALID)("%s", (name) => {
    const input = fixture(name)
    const result = stripWebp(input)

    it("leaves no identifying metadata when re-read", () => {
      const check = verifyCleanWebp(result.bytes)
      expect(check.findings).toEqual([])
      expect(check.clean).toBe(true)
    })

    it("leaves none of the injected text anywhere in the bytes", () => {
      for (const secret of WEBP_SECRETS) expect(containsText(result.bytes, secret), `found "${secret}"`).toBe(false)
    })

    it("keeps the image data byte for byte", () => {
      expect(toHex(extractImageData(result.bytes))).toBe(toHex(extractImageData(input)))
    })

    it("has a RIFF size that matches the file, an even length, and nothing after", () => {
      expect(le32(result.bytes, 4)).toBe(result.bytes.length - 8)
      expect(result.bytes.length % 2).toBe(0)
      expect(inspectWebp(result.bytes).trailingBytes).toBe(0)
    })

    it("keeps the Orientation value the original had", () => {
      expect(inspectWebp(result.bytes).orientation).toBe(inspectWebp(input).orientation)
    })

    it("zeroes every pad byte after an odd-sized chunk (padding is a place to hide data)", () => {
      for (const c of parseWebp(result.bytes).chunks) {
        if ((c.dataEnd - c.dataStart) & 1) expect(result.bytes[c.dataEnd], `pad after ${c.type}`).toBe(0)
      }
    })

    it("is idempotent: cleaning a clean file changes nothing", () => {
      expect(toHex(stripWebp(result.bytes).bytes)).toBe(toHex(result.bytes))
    })

    it("does not modify its input", () => {
      const copy = fixture(name)
      stripWebp(copy)
      expect(toHex(copy)).toBe(toHex(input))
    })
  })

  it("leaves one EXIF tag (Orientation) as the last chunk, with matching VP8X flags", () => {
    const out = stripWebp(fixture("webp-metadata.webp")).bytes
    expect(inspectWebp(out).exif!.entries).toEqual([{ ifd: "ifd0", tag: 0x0112 }])
    expect(types(out)).toEqual(["VP8X", "ICCP", "VP8 ", "EXIF"])
    expect(flagsOf(out)).toBe(0x20 | 0x08) // ICC and EXIF, XMP cleared
  })

  it("writes no EXIF chunk and clears its flag when there was no Orientation", () => {
    const out = stripWebp(fixture("webp-alpha-lossy.webp")).bytes
    expect(types(out)).toEqual(["VP8X", "ALPH", "VP8 "])
    expect(flagsOf(out)).toBe(0x10) // alpha only: XMP cleared, no EXIF
  })

  it("passes a simple file through unchanged", () => {
    const input = fixture("webp-simple.webp")
    expect(toHex(stripWebp(input).bytes)).toBe(toHex(input))
  })

  it("clears reserved flag bits and reserved bytes", () => {
    const out = stripWebp(fixture("webp-reserved-bits.webp")).bytes
    expect(flagsOf(out)).toBe(0x10)
    expect(inspectWebp(out).reservedBitsSet).toBe(false)
    expect(containsText(out, "FXT")).toBe(false)
  })

  it("keeps animation, drops the hidden frame sub-chunk, keeps every frame", () => {
    const out = stripWebp(fixture("webp-animated.webp")).bytes
    expect(types(out).filter((t) => t === "ANMF")).toHaveLength(3)
    expect(types(out)).toContain("ANIM")
    expect(inspectWebp(out).unknownFrameChunks).toBe(0)
    expect(flagsOf(out)! & 0x02).toBe(0x02) // animation flag kept
  })

  it("removes the colour profile when asked, clears its flag, and is still clean", () => {
    const result = stripWebp(fixture("webp-metadata.webp"), { removeIcc: true })
    expect(types(result.bytes)).not.toContain("ICCP")
    expect(flagsOf(result.bytes)! & 0x20).toBe(0)
    expect(verifyCleanWebp(result.bytes, { removeIcc: true }).clean).toBe(true)
    expect(result.removed.some((r) => r.kind === "icc")).toBe(true)
  })

  it("reports what it removed and what it kept", () => {
    const meta = stripWebp(fixture("webp-metadata.webp"))
    expect(meta.removed.map((r) => r.kind)).toEqual(expect.arrayContaining(["exif", "xmp", "other-segment"]))
    expect(meta.kept.some((k) => k.kind === "orientation")).toBe(true)
    expect(meta.kept.some((k) => k.kind === "icc")).toBe(true)
    expect(stripWebp(fixture("webp-trailing.webp")).removed.some((r) => r.kind === "trailing-data")).toBe(true)
  })

  it("throws on a corrupt file instead of returning a half-cleaned one", () => {
    expect(() => stripWebp(fixture("webp-corrupt.webp"))).toThrowError(MetadataError)
  })
})

describe("verifyCleanWebp (the check must be able to fail)", () => {
  it("flags every dirty fixture and accepts the already-clean one", () => {
    for (const name of VALID.filter((n) => n !== "webp-simple.webp")) {
      expect(verifyCleanWebp(fixture(name)).clean, name).toBe(false)
    }
    expect(verifyCleanWebp(fixture("webp-simple.webp")).clean).toBe(true)
  })

  it("flags an ICC profile only when removal was requested", () => {
    const clean = stripWebp(fixture("webp-metadata.webp")).bytes
    expect(verifyCleanWebp(clean).clean).toBe(true)
    expect(verifyCleanWebp(clean, { removeIcc: true }).clean).toBe(false)
  })

  it("flags a non-zero pad byte, on a file that is otherwise clean", () => {
    const clean = stripWebp(fixture("webp-pad-bytes.webp")).bytes.slice()
    expect(verifyCleanWebp(clean).clean).toBe(true) // the only thing wrong will be the pad byte
    const alph = parseWebp(clean).chunks.find((c) => c.type === "ALPH")!
    clean[alph.dataEnd] = 0x46
    const check = verifyCleanWebp(clean)
    expect(check.clean).toBe(false)
    expect(check.findings.join(" ")).toMatch(/pad/i)
  })

  it("flags a RIFF size that does not match the file", () => {
    const bad = stripWebp(fixture("webp-simple.webp")).bytes.slice()
    new DataView(bad.buffer).setUint32(4, bad.length - 8 - 2, true)
    expect(verifyCleanWebp(bad).clean).toBe(false)
  })
})
