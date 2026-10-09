// @vitest-environment node
import { describe, expect, it } from "vitest"
import { readExifFields, type ExifField } from "./exif"
import { exifTiff } from "./test-utils"

const find = (fields: ExifField[], ifd: string, tag: number) => fields.find((f) => f.ifd === ifd && f.tag === tag)

describe("readExifFields (values, not just tag numbers)", () => {
  const phone = readExifFields(exifTiff("phone-gps.jpg")!)!.fields

  it("reads text", () => {
    expect(find(phone, "ifd0", 0x010f)!.value).toBe("FixtureCo")
    expect(find(phone, "ifd0", 0x0110)!.value).toBe("Fixture Phone 1")
    expect(find(phone, "ifd0", 0x0131)!.value).toBe("FixtureOS 1.0")
    expect(find(phone, "exif", 0xa431)!.value).toBe("SN-0000-PHONE")
    expect(find(phone, "exif", 0x9003)!.value).toBe("2026:01:02 03:04:05")
  })

  it("reads numbers", () => {
    expect(find(phone, "ifd0", 0x0112)!.value).toBe(6)
    expect(find(phone, "ifd0", 0x0112)).toMatchObject({ type: 3, count: 1 })
  })

  it("reads rationals as numbers and keeps the exact numerator and denominator", () => {
    const lat = find(phone, "gps", 0x0002)!
    expect(lat.type).toBe(5)
    expect(lat.value).toEqual([22, 21, 54.24])
    expect(lat.rationals).toEqual([[22, 1], [21, 1], [5424, 100]])
    expect(find(phone, "gps", 0x0006)!.value).toBeCloseTo(12.34, 5)
    expect(find(phone, "gps", 0x0001)!.value).toBe("N")
  })

  it("reads byte arrays", () => {
    expect(find(phone, "gps", 0x0000)!.value).toEqual([2, 3, 0, 0])
  })

  it("reads the thumbnail directory in IFD1", () => {
    expect(find(phone, "ifd1", 0x0201)).toBeDefined()
    expect(typeof find(phone, "ifd1", 0x0202)!.value).toBe("number")
  })

  it("reads little-endian files", () => {
    const le = readExifFields(exifTiff("little-endian.jpg")!)!
    expect(le.byteOrder).toBe("II")
    expect(find(le.fields, "ifd0", 0x010f)!.value).toBe("LittleCo")
    expect(find(le.fields, "ifd0", 0x0112)!.value).toBe(8)
    expect(find(le.fields, "gps", 0x0001)!.value).toBe("N")
  })

  it("keeps the byte size of values it will not decode, such as maker notes", () => {
    const blob = readExifFields(buildTiff([{ tag: 0x927c, type: 7, bytes: new Uint8Array(40).fill(9) }], "exif"))!.fields.find((f) => f.tag === 0x927c)!
    expect(blob.size).toBe(40)
    expect(blob.value).toBeInstanceOf(Uint8Array)
  })

  it("returns a field with a null value, not an error, when its data points outside the block", () => {
    const tiff = buildTiff([{ tag: 0x010f, type: 2, bytes: new TextEncoder().encode("Hello world, long text\0") }], "ifd0")
    new DataView(tiff.buffer).setUint32(8 + 2 + 8, 100000, false) // corrupt the value offset
    const f = readExifFields(tiff)!.fields.find((x) => x.tag === 0x010f)!
    expect(f.value).toBeNull()
  })

  it("refuses absurd counts instead of allocating", () => {
    const tiff = buildTiff([{ tag: 0x010f, type: 2, bytes: new TextEncoder().encode("abcdef\0") }], "ifd0")
    new DataView(tiff.buffer).setUint32(8 + 2 + 4, 0x7fffffff, false) // count of two billion
    expect(readExifFields(tiff)!.fields.find((x) => x.tag === 0x010f)!.value).toBeNull()
  })

  it("returns null for something that is not a TIFF block", () => {
    expect(readExifFields(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toBeNull()
    expect(readExifFields(new Uint8Array(0))).toBeNull()
  })

  it("does not loop forever on a self-referencing IFD", () => {
    // IFD0 whose "next IFD" offset points back at itself
    const tiff = buildTiff([{ tag: 0x0112, type: 3, bytes: new Uint8Array([0, 6, 0, 0]) }], "ifd0")
    const dv = new DataView(tiff.buffer)
    dv.setUint32(8 + 2 + 12, 8, false)
    expect(readExifFields(tiff)!.fields).toHaveLength(1)
  })
})

/** Build a tiny big-endian TIFF with the given entries in one IFD (inline when 4 bytes or less, else after the IFD). */
function buildTiff(entries: { tag: number; type: number; bytes: Uint8Array }[], ifd: "ifd0" | "exif"): Uint8Array {
  const sizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 }
  const ifdLen = 2 + entries.length * 12 + 4
  let extra = 8 + ifdLen
  const body: number[] = []
  const out: number[] = [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8]
  const push16 = (a: number[], v: number) => a.push((v >> 8) & 255, v & 255)
  const push32 = (a: number[], v: number) => a.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255)
  // when ifd is "exif", IFD0 holds a single pointer to it
  if (ifd === "exif") {
    const inner = buildTiff(entries, "ifd0")
    const innerIfd = inner.subarray(8)
    const base = 8 + 2 + 12 + 4
    const adj = new Uint8Array(innerIfd)
    // shift value offsets by base - 8 (only used for out-of-line values)
    const dv = new DataView(adj.buffer)
    for (let i = 0; i < entries.length; i++) {
      const p = 2 + i * 12
      const total = sizes[entries[i].type] * (entries[i].bytes.length / (sizes[entries[i].type] || 1))
      if (total > 4) dv.setUint32(p + 8, dv.getUint32(p + 8, false) - 8 + base, false)
    }
    push16(out, 1)
    push16(out, 0x8769)
    push16(out, 4)
    push32(out, 1)
    push32(out, base)
    push32(out, 0)
    return new Uint8Array([...out, ...adj])
  }
  push16(out, entries.length)
  for (const e of entries) {
    const count = e.bytes.length / sizes[e.type]
    push16(out, e.tag)
    push16(out, e.type)
    push32(out, count)
    if (e.bytes.length <= 4) {
      out.push(...e.bytes, ...new Array(4 - e.bytes.length).fill(0))
    } else {
      push32(out, extra)
      body.push(...e.bytes)
      extra += e.bytes.length
    }
  }
  push32(out, 0)
  return new Uint8Array([...out, ...body])
}
