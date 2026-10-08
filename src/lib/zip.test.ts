// @vitest-environment node
import { describe, expect, it } from "vitest"
import { LIMITS } from "./limits"
import { fixture, toHex } from "./metadata/test-utils"
import { isJunkName, readZip, safeBaseName, uniqueNames, writeZip, zipToBytes, ZipError } from "./zip"

const BIG = { maxEntries: LIMITS.maxFiles, maxFileBytes: LIMITS.maxFileBytes, maxTotalBytes: LIMITS.maxTotalBytes }
const text = (s: string) => new TextEncoder().encode(s)
const code = async (p: Promise<unknown>) => {
  try {
    await p
    return "no error"
  } catch (e) {
    return e instanceof ZipError ? e.code : `other: ${e}`
  }
}

describe("safeBaseName", () => {
  it("keeps only the last path segment, splitting on / and \\", () => {
    expect(safeBaseName("../../evil.jpg")).toBe("evil.jpg")
    expect(safeBaseName("dir\\back.png")).toBe("back.png")
    expect(safeBaseName("a/b/c.webp")).toBe("c.webp")
    expect(safeBaseName("café.jpg")).toBe("café.jpg")
  })
})

describe("isJunkName", () => {
  it("spots macOS and Windows leftovers, and nothing else", () => {
    for (const junk of ["__MACOSX/x.jpg", "dir/._x.jpg", "._x.jpg", ".DS_Store", "a/.DS_Store", "Thumbs.db", "desktop.ini"]) {
      expect(isJunkName(junk), junk).toBe(true)
    }
    for (const ok of ["photo.jpg", "my._notes.jpg", "a/b/c.png", "DS_Store.jpg"]) expect(isJunkName(ok), ok).toBe(false)
  })
})

describe("uniqueNames", () => {
  it("numbers repeats before the extension and leaves unique names alone", () => {
    expect(uniqueNames(["a.jpg", "a.jpg", "b.png", "a.jpg"])).toEqual(["a.jpg", "a (2).jpg", "b.png", "a (3).jpg"])
    expect(uniqueNames(["noext", "noext"])).toEqual(["noext", "noext (2)"])
  })
})

describe("readZip", () => {
  for (const name of ["zip-store.zip", "zip-deflate.zip"]) {
    it(`reads ${name}: files only, junk and folders skipped, bytes identical`, async () => {
      const entries = await readZip(fixture(name), BIG)
      expect(entries.map((e) => e.path)).toEqual(["a.jpg", "nested/b.png", "nested/deeper/c.webp", "notes.txt"])
      expect(entries.map((e) => e.name)).toEqual(["a.jpg", "b.png", "c.webp", "notes.txt"])
      expect(toHex(entries[0].bytes)).toBe(toHex(fixture("phone-gps.jpg")))
      expect(toHex(entries[1].bytes)).toBe(toHex(fixture("png-metadata.png")))
      expect(toHex(entries[2].bytes)).toBe(toHex(fixture("webp-metadata.webp")))
      expect(new TextDecoder().decode(entries[3].bytes)).toBe("not a photo")
    })
  }

  it("reads awkward names safely", async () => {
    const entries = await readZip(fixture("zip-names.zip"), BIG)
    expect(entries.map((e) => e.name)).toEqual(["evil.jpg", "back.png", "café.jpg", "dup.jpg", "dup.jpg"])
  })

  it("stops a zip bomb by its declared size, before inflating", async () => {
    expect(await code(readZip(fixture("zip-bomb.zip"), { ...BIG, maxFileBytes: 1024 * 1024 }))).toBe("too-large")
  })

  it("stops an entry that inflates past its declared size", async () => {
    // Patch the declared sizes (central directory and local header) down to 10 bytes; the data still inflates to 20 MB.
    const lying = fixture("zip-bomb.zip")
    const view = new DataView(lying.buffer, lying.byteOffset, lying.byteLength)
    const cd = lying.findIndex((_, i) => view.getUint32(i, true) === 0x02014b50)
    view.setUint32(cd + 24, 10, true) // uncompressed size in the central header
    expect(await code(readZip(lying, BIG))).toBe("corrupt")
  })

  it("enforces the total size and entry count limits", async () => {
    expect(await code(readZip(fixture("zip-store.zip"), { ...BIG, maxTotalBytes: 2000 }))).toBe("too-large")
    expect(await code(readZip(fixture("zip-store.zip"), { ...BIG, maxEntries: 2 }))).toBe("too-many")
  })

  it("rejects encrypted entries as unsupported", async () => {
    expect(await code(readZip(fixture("zip-encrypted.zip"), BIG))).toBe("unsupported")
  })

  it("rejects ZIP64 markers as unsupported", async () => {
    const z64 = fixture("zip-store.zip")
    const view = new DataView(z64.buffer, z64.byteOffset, z64.byteLength)
    view.setUint16(z64.length - 22 + 10, 0xffff, true) // total entries
    expect(await code(readZip(z64, BIG))).toBe("unsupported")
  })

  it("rejects a data CRC mismatch, a truncated file and garbage as corrupt", async () => {
    expect(await code(readZip(fixture("zip-bad-crc.zip"), BIG))).toBe("corrupt")
    expect(await code(readZip(fixture("zip-truncated.zip"), BIG))).toBe("corrupt")
    expect(await code(readZip(new Uint8Array(100).fill(7), BIG))).toBe("corrupt")
    expect(await code(readZip(new Uint8Array(0), BIG))).toBe("corrupt")
  })
})

describe("writeZip", () => {
  it("writes exactly the structure documented in docs/formats/zip.md", () => {
    const zip = zipToBytes(writeZip([{ name: "a.txt", bytes: text("hello") }]))
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    // local header at 0
    expect(v.getUint32(0, true)).toBe(0x04034b50)
    expect(v.getUint16(6, true)).toBe(0x0800) // UTF-8 names, nothing else
    expect(v.getUint16(8, true)).toBe(0) // method: stored
    expect(v.getUint16(10, true)).toBe(0) // time 00:00:00
    expect(v.getUint16(12, true)).toBe(0x0021) // date 1980-01-01
    expect(v.getUint32(14, true)).toBe(0x3610a686) // CRC-32 of "hello"
    expect(v.getUint32(18, true)).toBe(5)
    expect(v.getUint32(22, true)).toBe(5)
    expect(v.getUint16(28, true)).toBe(0) // no extra field
    // central header right after the 40 bytes of local header + name + data
    expect(v.getUint32(40, true)).toBe(0x02014b50)
    expect(v.getUint16(40 + 4, true)).toBe(20) // made by: MS-DOS, version 2.0 (no Unix owner bits)
    expect(v.getUint32(40 + 38, true)).toBe(0) // external attributes: none
    expect(v.getUint32(40 + 42, true)).toBe(0) // offset of the local header
    // end of central directory is the last 22 bytes, no comment
    const e = zip.length - 22
    expect(v.getUint32(e, true)).toBe(0x06054b50)
    expect(v.getUint16(e + 8, true)).toBe(1)
    expect(v.getUint16(e + 10, true)).toBe(1)
    expect(v.getUint32(e + 16, true)).toBe(40) // central directory offset
    expect(v.getUint16(e + 20, true)).toBe(0) // no comment
  })

  it("round-trips through our own reader, including a non-ASCII name", async () => {
    const files = [
      { name: "café.jpg", bytes: fixture("phone-gps.jpg") },
      { name: "b.png", bytes: fixture("png-clean.png") },
      { name: "empty.webp", bytes: new Uint8Array(0) },
    ]
    const back = await readZip(zipToBytes(writeZip(files)), BIG)
    expect(back.map((e) => e.name)).toEqual(["café.jpg", "b.png", "empty.webp"])
    back.forEach((e, i) => expect(toHex(e.bytes)).toBe(toHex(files[i].bytes)))
  })

  it("writes a valid empty archive", async () => {
    const zip = zipToBytes(writeZip([]))
    expect(zip.length).toBe(22)
    expect(await readZip(zip, BIG)).toEqual([])
  })

  it("is deterministic: the same input always gives the same bytes", () => {
    const a = zipToBytes(writeZip([{ name: "x.jpg", bytes: fixture("no-metadata.jpg") }]))
    const b = zipToBytes(writeZip([{ name: "x.jpg", bytes: fixture("no-metadata.jpg") }]))
    expect(toHex(a)).toBe(toHex(b))
  })

  it("refuses names it cannot store and archives that are too big for ZIP", () => {
    expect(() => writeZip([{ name: "", bytes: text("x") }])).toThrowError(ZipError)
    expect(() => writeZip(Array.from({ length: 65536 }, (_, i) => ({ name: `f${i}`, bytes: new Uint8Array(0) })))).toThrowError(ZipError)
  })
})
