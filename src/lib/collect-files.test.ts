// @vitest-environment node
import { describe, expect, it } from "vitest"
import { collectFromDataTransfer, expandZips, filterCandidates, isPhotoName, planBatch } from "./collect-files"
import { LIMITS } from "./limits"
import { fixture } from "./metadata/test-utils"
import { writeZip, zipToBytes } from "./zip"

const file = (name: string, bytes: Uint8Array = new Uint8Array([1, 2, 3])) => new File([bytes as BlobPart], name)
const fake = (name: string, size: number) => ({ name, size }) as File
const names = (files: File[]) => files.map((f) => f.name)

describe("isPhotoName", () => {
  it("accepts the photo extensions in any case, and nothing else", () => {
    for (const n of ["a.jpg", "a.JPEG", "a.png", "a.webp", "a.HEIC", "a.heif"]) expect(isPhotoName(n), n).toBe(true)
    for (const n of ["notes.txt", "a.gif", "jpg", ".jpg", "a.jpg.exe", ".DS_Store", "a.zip"]) expect(isPhotoName(n), n).toBe(false)
  })
})

describe("filterCandidates", () => {
  it("keeps photos and ZIPs, drops the rest, and counts what it dropped", () => {
    const r = filterCandidates([file("a.jpg"), file("b.txt"), file("c.zip"), file("._d.jpg"), file(".DS_Store"), file("e.png")])
    expect(names(r.files)).toEqual(["a.jpg", "c.zip", "e.png"])
    expect(r.skipped).toBe(3)
  })
})

// A tiny fake of the browser's FileSystemEntry API, including its habit of returning directory
// contents in several batches until it hands back an empty one.
const fileEntry = (f: File) => ({ isFile: true, isDirectory: false, name: f.name, file: (ok: (f: File) => void) => ok(f) })
const dirEntry = (name: string, children: unknown[], batch = 2) => {
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => {
      let at = 0
      return {
        readEntries: (ok: (e: unknown[]) => void) => {
          const out = children.slice(at, at + batch)
          at += batch
          ok(out)
        },
      }
    },
  }
}
const transfer = (entries: unknown[]) =>
  ({ items: entries.map((e) => ({ kind: "file", webkitGetAsEntry: () => e, getAsFile: () => null })) }) as unknown as DataTransfer

describe("collectFromDataTransfer", () => {
  it("walks dropped folders, including nested ones and every batch of a directory listing", async () => {
    const tree = dirEntry("shoot", [
      fileEntry(file("1.jpg")),
      fileEntry(file("2.png")),
      fileEntry(file("3.webp")),
      fileEntry(file("notes.txt")),
      dirEntry("raw", [fileEntry(file("4.jpg")), fileEntry(file(".DS_Store"))]),
    ])
    const r = await collectFromDataTransfer(transfer([tree, fileEntry(file("loose.jpg"))]))
    expect(names(r.files).sort()).toEqual(["1.jpg", "2.png", "3.webp", "4.jpg", "loose.jpg"])
    expect(r.skipped).toBe(2) // notes.txt and .DS_Store
  })

  it("keeps explicitly dropped files even if they are not photos, so the person gets an honest error", async () => {
    const r = await collectFromDataTransfer(transfer([fileEntry(file("notes.txt"))]))
    expect(names(r.files)).toEqual(["notes.txt"])
    expect(r.skipped).toBe(0)
  })

  it("falls back to plain files when the browser has no folder API", async () => {
    const dt = { items: [{ kind: "file", getAsFile: () => file("a.jpg") }] } as unknown as DataTransfer
    expect(names((await collectFromDataTransfer(dt)).files)).toEqual(["a.jpg"])
  })

  it("stops reading a gigantic folder instead of walking all of it", async () => {
    const many = Array.from({ length: 5000 }, (_, i) => fileEntry(file(`${i}.jpg`)))
    const r = await collectFromDataTransfer(transfer([dirEntry("big", many, 100)]))
    expect(r.files.length).toBeLessThanOrEqual(LIMITS.maxFiles + 1)
    expect(r.truncated).toBe(true)
  })
})

describe("expandZips", () => {
  it("unpacks a ZIP into photo files and counts the non-photos it left out", async () => {
    const zip = new File([fixture("zip-store.zip") as BlobPart], "shoot.zip")
    const r = await expandZips([file("loose.jpg"), zip])
    expect(names(r.files)).toEqual(["loose.jpg", "a.jpg", "b.png", "c.webp"])
    expect(r.skipped).toBe(1) // notes.txt
    expect(r.errors).toEqual([])
    expect(r.files[1].size).toBe(fixture("phone-gps.jpg").length)
  })

  it("recognises a ZIP by its first bytes even when the name lies", async () => {
    const r = await expandZips([new File([fixture("zip-deflate.zip") as BlobPart], "renamed.dat")])
    expect(names(r.files)).toEqual(["a.jpg", "b.png", "c.webp"])
  })

  it("reports a broken ZIP in plain words and still returns the other files", async () => {
    const bad = new File([fixture("zip-truncated.zip") as BlobPart], "broken.zip")
    const r = await expandZips([file("ok.jpg"), bad])
    expect(names(r.files)).toEqual(["ok.jpg"])
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatch(/broken\.zip/)
    expect(r.errors[0]).toMatch(/damaged|does not look like/i)
  })

  it("explains encrypted and oversized ZIPs", async () => {
    const enc = await expandZips([new File([fixture("zip-encrypted.zip") as BlobPart], "locked.zip")])
    expect(enc.errors[0]).toMatch(/password/i)
    const bomb = await expandZips([new File([fixture("zip-bomb.zip") as BlobPart], "bomb.zip")], { ...LIMITS, maxFileBytes: 1024 })
    expect(bomb.errors[0]).toMatch(/too big/i)
  })
})

describe("planBatch", () => {
  it("accepts a normal batch untouched", () => {
    const plan = planBatch([fake("a.jpg", 10), fake("b.jpg", 20)])
    expect(plan.items.map((i) => i.error)).toEqual([undefined, undefined])
    expect(plan.notice).toBeNull()
  })

  it("marks a photo over the size limit as an error without counting it against the budget", () => {
    const plan = planBatch([fake("huge.jpg", LIMITS.maxFileBytes + 1), fake("ok.jpg", 10)])
    expect(plan.items[0].error).toMatch(/100 MB/)
    expect(plan.items[1].error).toBeUndefined()
  })

  it("keeps only the first 200 photos and says so", () => {
    const plan = planBatch(Array.from({ length: 205 }, (_, i) => fake(`${i}.jpg`, 1)))
    expect(plan.items).toHaveLength(LIMITS.maxFiles)
    expect(plan.notice).toMatch(/first 200/)
  })

  it("stops adding photos once the total size limit is reached and says so", () => {
    const each = 90 * 1024 * 1024
    const plan = planBatch(Array.from({ length: 8 }, (_, i) => fake(`${i}.jpg`, each)))
    expect(plan.items.length).toBe(5) // 5 x 90 MB = 450 MB; a sixth would pass 500 MB
    expect(plan.notice).toMatch(/500 MB/)
  })
})
