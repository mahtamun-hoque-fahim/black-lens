// @vitest-environment node
import { describe, expect, it } from "vitest"
import { EMPTY_TAGS, isEmptyTags, normalizeTags, tagLines, TAG_LIMITS } from "./tags"

const ok = (input: Parameters<typeof normalizeTags>[0]) => {
  const r = normalizeTags(input)
  expect(r.errors).toEqual([])
  return r.tags
}
const errorFor = (input: Parameters<typeof normalizeTags>[0], field: string) => normalizeTags(input).errors.find((e) => e.field === field)?.message

describe("normalizeTags: text", () => {
  it("trims and leaves everything else alone", () => {
    expect(ok({ artist: "  Fahim  ", copyright: "(c) 2026 Fahim. All rights reserved." }).artist).toBe("Fahim")
  })

  it("makes the same text the same bytes (NFC)", () => {
    expect(ok({ artist: "Jose\u0301" }).artist).toBe("Jos\u00e9")
  })

  it("keeps Bengali, accented and other scripts exactly, including zero-width joiners", () => {
    const bengali = "\u09ab\u09be\u09b9\u09bf\u09ae" // a name in Bengali script
    expect(ok({ artist: bengali }).artist).toBe(bengali)
    const withJoiner = "\u09b0\u200d\u09af" // ra + ZWJ + ya: a real conjunct that needs the joiner
    expect(ok({ artist: withJoiner }).artist).toBe(withJoiner)
    expect(ok({ title: "Caf\u00e9 \u5199\u771f \u0645\u0631\u062d\u0628\u0627" }).title).toBe("Caf\u00e9 \u5199\u771f \u0645\u0631\u062d\u0628\u0627")
  })

  it("removes control characters, bidirectional overrides, byte order marks and NUL", () => {
    expect(ok({ artist: "A\u0000B\u0007C\u202eD\u2066E\ufeffF" }).artist).toBe("ABCDEF")
  })

  it("turns line breaks in one-line fields into a space and collapses runs of spaces", () => {
    expect(ok({ artist: "A\nB\r\nC   D\tE" }).artist).toBe("A B C D E")
    expect(ok({ title: "one\u2028two" }).title).toBe("one two")
  })

  it("lets a description keep its line breaks, written as plain \\n", () => {
    expect(ok({ description: "line one\r\nline two\rline three\u2029\u2029line five" }).description).toBe("line one\nline two\nline three\n\nline five")
    expect(ok({ description: "a\n\n\n\n\nb" }).description).toBe("a\n\nb") // no more than one blank line
  })

  it("replaces lone surrogates, which are not valid text", () => {
    expect(ok({ artist: "a\ud800b" }).artist).toBe("a\ufffdb")
  })

  it("treats a missing field as empty", () => {
    expect(ok({})).toEqual(EMPTY_TAGS)
  })
})

describe("normalizeTags: limits", () => {
  it("rejects over-length text with a plain message instead of silently cutting it", () => {
    expect(errorFor({ artist: "x".repeat(TAG_LIMITS.artist + 1) }, "artist")).toBe("Artist is longer than 200 characters.")
    expect(errorFor({ copyright: "x".repeat(501) }, "copyright")).toBe("Copyright is longer than 500 characters.")
    expect(errorFor({ title: "x".repeat(201) }, "title")).toBe("Title is longer than 200 characters.")
    expect(errorFor({ description: "x".repeat(2001) }, "description")).toBe("Description is longer than 2000 characters.")
    const r = normalizeTags({ artist: "x".repeat(201) })
    expect(r.tags.artist).toBe("") // never a half-written value
  })

  it("accepts text exactly at the limit", () => {
    expect(normalizeTags({ artist: "x".repeat(200), description: "y".repeat(2000) }).errors).toEqual([])
  })

  it("counts characters people see, not code units (an emoji is one)", () => {
    expect(normalizeTags({ title: "\u{1F600}".repeat(200) }).errors).toEqual([])
    expect(errorFor({ title: "\u{1F600}".repeat(201) }, "title")).toBeDefined()
  })
})

describe("normalizeTags: keywords", () => {
  it("splits on commas, trims, drops empties and duplicates (ignoring case)", () => {
    expect(ok({ keywords: "sea,  Boats ,, boats, harbour " }).keywords).toEqual(["sea", "Boats", "harbour"])
  })

  it("accepts a list as well as a string", () => {
    expect(ok({ keywords: ["a", " b ", "A"] }).keywords).toEqual(["a", "b"])
  })

  it("rejects too many keywords and keywords that are too long", () => {
    expect(errorFor({ keywords: Array.from({ length: 51 }, (_, i) => `k${i}`) }, "keywords")).toBe("Keywords: use 50 or fewer.")
    expect(errorFor({ keywords: "x".repeat(101) }, "keywords")).toBe("Each keyword can be at most 100 characters.")
  })
})

describe("normalizeTags: date", () => {
  it("accepts a real date", () => {
    expect(ok({ date: "2026-01-02" }).date).toBe("2026-01-02")
    expect(ok({ date: "2024-02-29" }).date).toBe("2024-02-29") // a leap day
    expect(ok({ date: " 2026-12-31 " }).date).toBe("2026-12-31")
  })

  it("rejects dates that are not real, with one clear message", () => {
    const message = "Date must be a real date, like 2026-01-02."
    for (const bad of ["2025-02-29", "2026-02-30", "2026-13-01", "2026-00-10", "2026-04-31", "26-1-2", "2026/01/02", "yesterday", "1899-12-31", "2101-01-01"]) {
      expect(errorFor({ date: bad }, "date"), bad).toBe(message)
    }
  })
})

describe("isEmptyTags and tagLines", () => {
  it("knows when there is nothing to write", () => {
    expect(isEmptyTags(EMPTY_TAGS)).toBe(true)
    expect(isEmptyTags(ok({ keywords: "a" }))).toBe(false)
  })

  it("lists only what will be written, in a fixed order, in plain words", () => {
    const tags = ok({ date: "2026-01-02", artist: "Fahim", keywords: "sea, boats" })
    expect(tagLines(tags)).toEqual([
      { label: "Artist", value: "Fahim" },
      { label: "Keywords", value: "sea, boats" },
      { label: "Date", value: "2026-01-02" },
    ])
    expect(tagLines(EMPTY_TAGS)).toEqual([])
  })
})
