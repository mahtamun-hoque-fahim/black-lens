// @vitest-environment node
import { describe, expect, it } from "vitest"
import { MetadataError } from "../errors"
import { containsText, fixture, toHex } from "../test-utils"
import { buildOrientationApp1 } from "./exif"
import { extractImageData, parseJpeg } from "./parse"
import { inspectJpeg } from "./inspect"
import { stripJpeg } from "./strip"
import { verifyCleanJpeg } from "./verify"

// Every fixture that is a valid JPEG. corrupt-truncated.jpg is tested separately.
const VALID = [
  "phone-gps.jpg",
  "camera-xmp-iptc.jpg",
  "progressive.jpg",
  "no-metadata.jpg",
  "trailing-data.jpg",
  "cmyk-adobe.jpg",
  "little-endian.jpg",
] as const

// Text that must never survive Clean. Each string was injected by scripts/make-fixtures.py.
const SECRETS = [
  "FixtureCo",
  "FixtureCam",
  "LittleCo",
  "Fixture Phone",
  "FixtureOS",
  "SN-0000-PHONE",
  "SN-1111-CAMERA",
  "SN-2222-LENS",
  "Fixture Photographer",
  "(c) Fixture",
  "Fixture Editor",
  "Fixture caption",
  "fixture-keyword",
  "secret place",
  "2026:01:02",
  "ftypmp42",
]

describe("buildOrientationApp1", () => {
  it("writes the exact 36 bytes documented in docs/formats/jpeg.md", () => {
    expect(toHex(buildOrientationApp1(6))).toBe(
      [
        "ffe1", // APP1 marker
        "0022", // length 34 = 2 (itself) + 32 (payload)
        "457869660000", // "Exif\0\0"
        "4d4d002a", // big-endian byte order + magic 42
        "00000008", // IFD0 starts 8 bytes in
        "0001", // one entry
        "0112", // tag Orientation
        "0003", // type SHORT
        "00000001", // count 1
        "00060000", // value 6, left-justified in the 4-byte field
        "00000000", // no next IFD
      ].join(""),
    )
  })
})

describe("parseJpeg", () => {
  it("walks a baseline file and finds SOI first and EOI last", () => {
    const bytes = fixture("no-metadata.jpg")
    const jpeg = parseJpeg(bytes)
    expect(jpeg.segments[0].marker).toBe(0xd8)
    expect(jpeg.segments[jpeg.segments.length - 1].marker).toBe(0xd9)
    expect(jpeg.endOffset).toBe(bytes.length)
    expect(jpeg.trailingBytes).toBe(0)
  })

  it("keeps all scans of a progressive file", () => {
    const jpeg = parseJpeg(fixture("progressive.jpg"))
    expect(jpeg.segments.filter((s) => s.marker === 0xda).length).toBeGreaterThan(1)
  })

  it("measures data after the first EOI as trailing bytes", () => {
    const phone = fixture("phone-gps.jpg")
    const jpeg = parseJpeg(fixture("trailing-data.jpg"))
    expect(jpeg.endOffset).toBe(phone.length)
    expect(jpeg.trailingBytes).toBeGreaterThan(300)
  })

  it("rejects a truncated file as corrupt", () => {
    expect(() => parseJpeg(fixture("corrupt-truncated.jpg"))).toThrowError(MetadataError)
    try {
      parseJpeg(fixture("corrupt-truncated.jpg"))
    } catch (e) {
      expect((e as MetadataError).code).toBe("corrupt")
    }
  })

  it("rejects bytes that do not start with SOI", () => {
    expect(() => parseJpeg(new Uint8Array([1, 2, 3, 4]))).toThrowError(MetadataError)
  })
})

describe("inspectJpeg (the reader)", () => {
  it("finds GPS, camera, serial and thumbnail tags in the phone fixture", () => {
    const info = inspectJpeg(fixture("phone-gps.jpg"))
    const has = (ifd: string, tag: number) => info.exif!.entries.some((e) => e.ifd === ifd && e.tag === tag)
    expect(info.orientation).toBe(6)
    expect(info.icc).toBe(true)
    expect(has("ifd0", 0x010f)).toBe(true) // Make
    expect(has("ifd0", 0x0110)).toBe(true) // Model
    expect(has("exif", 0xa431)).toBe(true) // BodySerialNumber
    expect(has("gps", 0x0002)).toBe(true) // GPSLatitude
    expect(has("gps", 0x0004)).toBe(true) // GPSLongitude
    expect(has("ifd1", 0x0201)).toBe(true) // thumbnail offset
  })

  it("finds XMP, IPTC and a comment in the camera fixture", () => {
    const info = inspectJpeg(fixture("camera-xmp-iptc.jpg"))
    expect(info.xmp).toBe(true)
    expect(info.iptc).toBe(true)
    expect(info.comments).toBe(1)
    expect(info.orientation).toBe(1)
  })

  it("reads a little-endian EXIF block", () => {
    const info = inspectJpeg(fixture("little-endian.jpg"))
    expect(info.exif!.byteOrder).toBe("II")
    expect(info.orientation).toBe(8)
    expect(info.exif!.entries.some((e) => e.ifd === "gps" && e.tag === 0x0001)).toBe(true)
  })

  it("sees the Adobe APP14 segment in the CMYK file", () => {
    const info = inspectJpeg(fixture("cmyk-adobe.jpg"))
    expect(info.segments.some((s) => s.marker === 0xee && s.signature === "Adobe")).toBe(true)
  })

  it("reports a file with no metadata as having none", () => {
    const info = inspectJpeg(fixture("no-metadata.jpg"))
    expect(info.exif).toBeNull()
    expect(info.orientation).toBeNull()
    expect(info.xmp || info.iptc || info.icc).toBe(false)
    expect(info.comments).toBe(0)
  })
})

describe("stripJpeg", () => {
  describe.each(VALID)("%s", (name) => {
    const input = fixture(name)
    const result = stripJpeg(input)

    it("leaves no identifying metadata when re-read", () => {
      const check = verifyCleanJpeg(result.bytes)
      expect(check.findings).toEqual([])
      expect(check.clean).toBe(true)
    })

    it("leaves none of the injected text anywhere in the bytes", () => {
      for (const secret of SECRETS) {
        expect(containsText(result.bytes, secret), `found "${secret}"`).toBe(false)
      }
    })

    it("keeps the image data byte for byte", () => {
      expect(toHex(extractImageData(result.bytes))).toBe(toHex(extractImageData(input)))
    })

    it("ends exactly at EOI with nothing after it", () => {
      expect(result.bytes[0]).toBe(0xff)
      expect(result.bytes[1]).toBe(0xd8)
      expect(result.bytes[result.bytes.length - 2]).toBe(0xff)
      expect(result.bytes[result.bytes.length - 1]).toBe(0xd9)
      expect(inspectJpeg(result.bytes).trailingBytes).toBe(0)
    })

    it("keeps the Orientation value the original had", () => {
      expect(inspectJpeg(result.bytes).orientation).toBe(inspectJpeg(input).orientation)
    })

    it("is idempotent: cleaning a clean file changes nothing", () => {
      expect(toHex(stripJpeg(result.bytes).bytes)).toBe(toHex(result.bytes))
    })

    it("does not modify its input", () => {
      const copy = fixture(name)
      stripJpeg(copy)
      expect(toHex(copy)).toBe(toHex(input))
    })
  })

  it("leaves exactly one EXIF tag (Orientation) when the original had EXIF", () => {
    const out = inspectJpeg(stripJpeg(fixture("phone-gps.jpg")).bytes)
    expect(out.exif!.entries).toEqual([{ ifd: "ifd0", tag: 0x0112 }])
  })

  it("writes no EXIF segment at all when the original had no Orientation", () => {
    const out = inspectJpeg(stripJpeg(fixture("no-metadata.jpg")).bytes)
    expect(out.exif).toBeNull()
  })

  it("passes an already clean file through unchanged", () => {
    const input = fixture("no-metadata.jpg")
    expect(toHex(stripJpeg(input).bytes)).toBe(toHex(input))
  })

  it("keeps the ICC colour profile by default", () => {
    const result = stripJpeg(fixture("phone-gps.jpg"))
    expect(inspectJpeg(result.bytes).icc).toBe(true)
    expect(result.kept.some((k) => k.kind === "icc")).toBe(true)
  })

  it("removes the ICC colour profile when asked, and is still clean", () => {
    const result = stripJpeg(fixture("phone-gps.jpg"), { removeIcc: true })
    expect(inspectJpeg(result.bytes).icc).toBe(false)
    expect(verifyCleanJpeg(result.bytes, { removeIcc: true }).clean).toBe(true)
    expect(result.removed.some((r) => r.kind === "icc")).toBe(true)
  })

  it("keeps the Adobe APP14 segment so CMYK still decodes", () => {
    const out = inspectJpeg(stripJpeg(fixture("cmyk-adobe.jpg")).bytes)
    expect(out.segments.some((s) => s.marker === 0xee && s.signature === "Adobe")).toBe(true)
  })

  it("drops the JFIF thumbnail but keeps JFIF itself", () => {
    const out = inspectJpeg(stripJpeg(fixture("phone-gps.jpg")).bytes)
    expect(out.segments.some((s) => s.marker === 0xe0 && s.signature === "JFIF")).toBe(true)
  })

  it("reports what it removed and what it kept", () => {
    const camera = stripJpeg(fixture("camera-xmp-iptc.jpg"))
    const kinds = camera.removed.map((r) => r.kind)
    expect(kinds).toEqual(expect.arrayContaining(["exif", "xmp", "iptc", "comment"]))
    expect(camera.kept.some((k) => k.kind === "orientation")).toBe(true)

    const trailing = stripJpeg(fixture("trailing-data.jpg"))
    expect(trailing.removed.some((r) => r.kind === "trailing-data")).toBe(true)
  })

  it("makes the file smaller when there was something to remove", () => {
    const input = fixture("phone-gps.jpg")
    expect(stripJpeg(input).bytes.length).toBeLessThan(input.length)
  })

  it("throws on a corrupt file instead of returning a half-cleaned one", () => {
    expect(() => stripJpeg(fixture("corrupt-truncated.jpg"))).toThrowError(MetadataError)
  })
})

describe("verifyCleanJpeg (the check must be able to fail)", () => {
  it("flags GPS in a dirty file", () => {
    const check = verifyCleanJpeg(fixture("phone-gps.jpg"))
    expect(check.clean).toBe(false)
    expect(check.findings.length).toBeGreaterThan(0)
  })

  it("flags XMP, IPTC, comments and trailing data in dirty files", () => {
    expect(verifyCleanJpeg(fixture("camera-xmp-iptc.jpg")).clean).toBe(false)
    expect(verifyCleanJpeg(fixture("trailing-data.jpg")).clean).toBe(false)
  })

  it("flags an ICC profile only when removal was requested", () => {
    const clean = stripJpeg(fixture("phone-gps.jpg")).bytes
    expect(verifyCleanJpeg(clean).clean).toBe(true)
    expect(verifyCleanJpeg(clean, { removeIcc: true }).clean).toBe(false)
  })
})
