// @vitest-environment node
import { describe, expect, it } from "vitest"
import { readExifFields } from "./exif"
import { buildExifFromTags, isPrintableAscii } from "./exif-write"
import { EMPTY_TAGS, normalizeTags, type Tags } from "./tags"
import { buildXmp } from "./xmp-write"
import { parseXmp } from "./xmp"

const tags = (input: Parameters<typeof normalizeTags>[0]): Tags => normalizeTags(input).tags
const decode = (b: Uint8Array) => new TextDecoder().decode(b)

describe("buildXmp", () => {
  const full = tags({ artist: "Fahim", copyright: "(c) 2026 Fahim", title: "Harbour", description: "Evening light.\nSecond line.", keywords: "sea, boats", date: "2026-01-02" })

  it("is a UTF-8 packet that our own reader reads back field by field", () => {
    const fields = parseXmp(decode(buildXmp(full)!))
    const v = (label: string) => fields.find((f) => f.label === label)?.value
    expect(v("Creator")).toBe("Fahim")
    expect(v("Rights")).toBe("(c) 2026 Fahim")
    expect(v("Title")).toBe("Harbour")
    expect(v("Description")).toBe("Evening light.\nSecond line.")
    expect(v("Keywords")).toBe("sea, boats")
    expect(v("Created")).toBe("2026-01-02")
  })

  it("keeps non-Latin text as real UTF-8", () => {
    const bengali = "\u09ab\u09be\u09b9\u09bf\u09ae"
    const bytes = buildXmp(tags({ artist: bengali, title: "Caf\u00e9" }))!
    expect(decode(bytes)).toContain(bengali)
    expect(parseXmp(decode(bytes)).find((f) => f.label === "Creator")!.value).toBe(bengali)
  })

  it("writes only what was filled in, and nothing at all when everything is empty", () => {
    const only = parseXmp(decode(buildXmp(tags({ title: "Just a title" }))!))
    expect(only.map((f) => f.label)).toEqual(["Title"])
    expect(buildXmp(EMPTY_TAGS)).toBeNull()
  })

  it("can never be made to contain markup, whatever is typed", () => {
    const hostile = tags({
      artist: `Fish & Chips <b>bold</b> "quoted" 'single'`,
      copyright: "]]></rdf:li></dc:rights><evil attr='x'/>",
      title: `<?xpacket end="w"?>`,
      description: "</x:xmpmeta><script>alert(1)</script>\n<!-- comment -->",
      keywords: "<k1>, a&b, ]]>",
    })
    const text = decode(buildXmp(hostile)!)
    // Every tag in the output is from the fixed vocabulary. A value cannot add one.
    const allowed = new Set(["x:xmpmeta", "rdf:RDF", "rdf:Description", "dc:creator", "dc:rights", "dc:title", "dc:description", "dc:subject", "xmp:CreateDate", "rdf:Seq", "rdf:Alt", "rdf:Bag", "rdf:li"])
    const names = [...text.matchAll(/<\/?([A-Za-z][\w:.-]*)/g)].map((m) => m[1])
    expect(names.length).toBeGreaterThan(5)
    for (const n of names) expect(allowed.has(n), `unexpected tag <${n}>`).toBe(true)
    // exactly one xpacket start and one end
    expect([...text.matchAll(/<\?xpacket/g)]).toHaveLength(2)
    expect(text).not.toContain("<evil")
    expect(text).not.toContain("<script")
    expect(text).not.toContain("<!--")
    // and the original text comes back out unharmed
    const back = parseXmp(text)
    expect(back.find((f) => f.label === "Creator")!.value).toBe(hostile.artist)
    expect(back.find((f) => f.label === "Rights")!.value).toBe(hostile.copyright)
    expect(back.find((f) => f.label === "Description")!.value).toBe(hostile.description)
  })

  it("fits in a JPEG segment even in the worst case", () => {
    const worst = tags({
      artist: "\u{1F600}".repeat(200),
      copyright: "\u{1F600}".repeat(500),
      title: "\u{1F600}".repeat(200),
      description: "\u{1F600}".repeat(2000),
      keywords: Array.from({ length: 50 }, (_, i) => `${i}`.padStart(2, "0") + "\u{1F600}".repeat(98)),
      date: "2026-01-02",
    })
    expect(buildXmp(worst)!.length).toBeLessThan(60 * 1024)
  })

  it("does not write Black Lens, a tool name, an edit history or an ID into the photo", () => {
    const text = decode(buildXmp(full)!)
    for (const unwanted of ["Black Lens", "CreatorTool", "DocumentID", "InstanceID", "History", "MetadataDate", "ModifyDate"]) expect(text).not.toContain(unwanted)
  })
})

/** Strict enough to catch what a lenient reader forgives: stray markup characters in text, and bare ampersands. */
function wellFormedProblems(xml: string): string[] {
  const problems: string[] = []
  const body = xml.replace(/<\?xpacket[^>]*\?>/g, "")
  const text = body.replace(/<\/?[A-Za-z][^<>]*>/g, "\u0000") // every real tag becomes a marker
  if (/[<>]/.test(text.replace(/\u0000/g, ""))) problems.push("a bare < or > outside a tag")
  if (/&(?!(amp|lt|gt|quot|apos);)/.test(text)) problems.push("a bare & that is not an entity")
  // tags must open and close in order
  const stack: string[] = []
  for (const m of body.matchAll(/<(\/?)([A-Za-z][\w:.-]*)[^<>]*?(\/?)>/g)) {
    if (m[3]) continue
    if (!m[1]) stack.push(m[2])
    else if (stack.pop() !== m[2]) problems.push(`mismatched </${m[2]}>`)
  }
  if (stack.length) problems.push(`unclosed <${stack[stack.length - 1]}>`)
  return problems
}

describe("buildXmp is well-formed XML for any text", () => {
  const samples = [
    { artist: "Fish & Chips" },
    { artist: "AT&T <research> & \"co\" 'x'" },
    { description: "a < b && c > d\n&amp; &lt; already-escaped-looking &#169;" },
    { title: "]]> <![CDATA[ x ]]>", keywords: "<k>, &, \"q\", 'a'" },
    { copyright: "</rdf:li></dc:rights><x/>" },
  ]
  it.each(samples.map((s, i) => [i, s] as const))("sample %i", (_, input) => {
    expect(wellFormedProblems(decode(buildXmp(tags(input))!))).toEqual([])
  })

  it("the check itself can fail (so a pass means something)", () => {
    expect(wellFormedProblems("<a>x & y</a>")).toContain("a bare & that is not an entity")
    expect(wellFormedProblems("<a>x < y</a>").length).toBeGreaterThan(0)
    expect(wellFormedProblems("<a><b></a>").length).toBeGreaterThan(0)
  })
})

describe("isPrintableAscii", () => {
  it("accepts plain ASCII and rejects everything else", () => {
    expect(isPrintableAscii("(c) 2026 Fahim, All rights reserved.")).toBe(true)
    expect(isPrintableAscii("caf\u00e9")).toBe(false)
    expect(isPrintableAscii("\u09ab")).toBe(false)
    expect(isPrintableAscii("a\u0001b")).toBe(false)
    expect(isPrintableAscii("")).toBe(true)
  })
})

describe("buildExifFromTags", () => {
  const get = (b: Uint8Array) => readExifFields(b)!.fields
  const find = (f: ReturnType<typeof get>, ifd: string, tag: number) => f.find((x) => x.ifd === ifd && x.tag === tag)?.value

  it("writes the ASCII fields and the date, and keeps Orientation", () => {
    const b = buildExifFromTags(tags({ artist: "Fahim", copyright: "(c) 2026 Fahim", description: "A caption", date: "2026-01-02" }), 6)!
    const f = get(b)
    expect(find(f, "ifd0", 0x013b)).toBe("Fahim")
    expect(find(f, "ifd0", 0x8298)).toBe("(c) 2026 Fahim")
    expect(find(f, "ifd0", 0x010e)).toBe("A caption")
    expect(find(f, "ifd0", 0x0112)).toBe(6)
    expect(find(f, "exif", 0x9003)).toBe("2026:01:02 00:00:00")
  })

  it("leaves a field out of EXIF when it is not plain ASCII (XMP carries it instead)", () => {
    const f = get(buildExifFromTags(tags({ artist: "Fahim \u09ab\u09be", copyright: "(c) Fahim" }), null)!)
    expect(find(f, "ifd0", 0x013b)).toBeUndefined()
    expect(find(f, "ifd0", 0x8298)).toBe("(c) Fahim")
  })

  it("does not put Title or Keywords in EXIF, which has no place for them", () => {
    const f = get(buildExifFromTags(tags({ title: "T", keywords: "a, b", artist: "A" }), null)!)
    expect(f.map((x) => x.tag).sort()).toEqual([0x013b])
  })

  it("writes entries in tag order, with every value on an even offset", () => {
    const b = buildExifFromTags(tags({ artist: "abc", copyright: "defgh", description: "ij", date: "2026-01-02" }), 3)!
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
    const count = view.getUint16(8)
    const tagList = Array.from({ length: count }, (_, i) => view.getUint16(10 + i * 12))
    expect(tagList).toEqual([...tagList].sort((a, c) => a - c))
    for (let i = 0; i < count; i++) {
      const size = view.getUint32(10 + i * 12 + 4) * (view.getUint16(10 + i * 12 + 2) === 2 ? 1 : 2)
      if (size > 4) expect(view.getUint32(10 + i * 12 + 8) % 2).toBe(0)
    }
  })

  it("is exactly the orientation-only block when there is nothing else", () => {
    expect(buildExifFromTags(EMPTY_TAGS, 6)!.length).toBe(26)
  })

  it("returns nothing when there is nothing to write", () => {
    expect(buildExifFromTags(EMPTY_TAGS, null)).toBeNull()
    expect(buildExifFromTags(tags({ title: "T", keywords: "a" }), null)).toBeNull() // nothing EXIF can hold
  })

  it("keeps a newline in a description", () => {
    expect(find(get(buildExifFromTags(tags({ description: "one\ntwo" }), null)!), "ifd0", 0x010e)).toBe("one\ntwo")
  })
})
