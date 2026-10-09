// @vitest-environment node
import { describe, expect, it } from "vitest"
import { jpegParts } from "./jpeg/parts"
import { parseIptc } from "./iptc"
import { fixture } from "./test-utils"
import { parseXmp } from "./xmp"

const get = (fields: { label: string; value: string }[], label: string) => fields.find((f) => f.label === label)
const xmp = (inner: string) =>
  `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description ${inner}</rdf:Description></rdf:RDF></x:xmpmeta>`

describe("parseXmp", () => {
  it("reads the creator and the editing tool from the fixture's packet", () => {
    const parts = jpegParts(fixture("camera-xmp-iptc.jpg"))
    const fields = parseXmp(new TextDecoder().decode(parts.xmp!))
    expect(get(fields, "Creator")).toMatchObject({ group: "author", value: "Fixture Photographer", source: "XMP" })
    expect(get(fields, "Creator tool")).toMatchObject({ group: "software", value: "Fixture Editor 9", source: "XMP" })
  })

  it("reads lists written as rdf:Alt, rdf:Seq and rdf:Bag", () => {
    const fields = parseXmp(
      xmp(`><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Harbour at dusk</rdf:li></rdf:Alt></dc:title>
        <dc:creator><rdf:Seq><rdf:li>Amina Rahman</rdf:li><rdf:li>Tariq Hasan</rdf:li></rdf:Seq></dc:creator>
        <dc:subject><rdf:Bag><rdf:li>sea</rdf:li><rdf:li>boats</rdf:li></rdf:Bag></dc:subject>`),
    )
    expect(get(fields, "Title")!.value).toBe("Harbour at dusk")
    expect(get(fields, "Creator")!.value).toBe("Amina Rahman, Tariq Hasan")
    expect(get(fields, "Keywords")!.value).toBe("sea, boats")
  })

  it("reads properties written as attributes, and unescapes entities", () => {
    const fields = parseXmp(xmp(`xmp:CreatorTool="Editor &amp; Co &#169; 9" xmp:CreateDate="2026-01-02T03:04:05+06:00" photoshop:City="Chattogram" tiff:Make="FixtureCo">`))
    expect(get(fields, "Creator tool")!.value).toBe("Editor & Co © 9")
    expect(get(fields, "Created")).toMatchObject({ group: "dates", value: "2026-01-02T03:04:05+06:00" })
    expect(get(fields, "City")).toMatchObject({ group: "location", value: "Chattogram" })
    expect(get(fields, "Make")).toMatchObject({ group: "camera", value: "FixtureCo" })
  })

  it("lists each program in the edit history once", () => {
    const fields = parseXmp(
      xmp(`><xmpMM:History><rdf:Seq><rdf:li stEvt:action="saved" stEvt:softwareAgent="Editor 9"/><rdf:li stEvt:action="saved" stEvt:softwareAgent="Editor 9"/><rdf:li stEvt:softwareAgent="Phone Camera 3"/></rdf:Seq></xmpMM:History>`),
    )
    expect(get(fields, "Edited with")!.value).toBe("Editor 9, Phone Camera 3")
  })

  it("shows the unique document ID, which can link copies of a photo", () => {
    expect(get(parseXmp(xmp(`xmpMM:DocumentID="xmp.did:1234-abcd">`)), "Document ID")).toMatchObject({ group: "extras", value: "xmp.did:1234-abcd" })
  })

  it("treats markup as plain text and never throws on garbage", () => {
    const fields = parseXmp(xmp(`><dc:title><rdf:Alt><rdf:li>&lt;script&gt;alert(1)&lt;/script&gt;</rdf:li></rdf:Alt></dc:title>`))
    expect(get(fields, "Title")!.value).toBe("<script>alert(1)</script>")
    expect(parseXmp("<<<not xml at all")).toEqual([])
    expect(parseXmp("")).toEqual([])
  })

  it("does not read more than it should from a huge packet", () => {
    const huge = "x".repeat(5 * 1024 * 1024) + xmp(`xmp:CreatorTool="late">`)
    expect(get(parseXmp(huge), "Creator tool")).toBeUndefined()
  })
})

describe("parseIptc", () => {
  it("reads the title, byline, copyright, caption and keywords from the fixture", () => {
    const fields = parseIptc(jpegParts(fixture("camera-xmp-iptc.jpg")).iptc!)
    expect(get(fields, "Title")).toMatchObject({ group: "notes", value: "Fixture Title", source: "IPTC" })
    expect(get(fields, "Photographer")).toMatchObject({ group: "author", value: "Fixture Photographer" })
    expect(get(fields, "Copyright notice")).toMatchObject({ group: "author", value: "(c) Fixture 2026" })
    expect(get(fields, "Caption")).toMatchObject({ group: "notes", value: "Fixture caption text" })
    expect(get(fields, "Keywords")).toMatchObject({ group: "notes", value: "fixture-keyword" })
  })

  it("joins repeated keywords", () => {
    const rec = (ds: number, s: string) => [0x1c, 2, ds, 0, s.length, ...new TextEncoder().encode(s)]
    const data = new Uint8Array([...rec(25, "sea"), ...rec(25, "boats"), ...rec(90, "Chattogram"), ...rec(101, "Bangladesh")])
    const irb = new Uint8Array([...new TextEncoder().encode("8BIM"), 0x04, 0x04, 0, 0, 0, 0, 0, data.length, ...data])
    const fields = parseIptc(irb)
    expect(get(fields, "Keywords")!.value).toBe("sea, boats")
    expect(get(fields, "City")).toMatchObject({ group: "location", value: "Chattogram" })
    expect(get(fields, "Country")).toMatchObject({ group: "location", value: "Bangladesh" })
  })

  it("never throws on truncated or hostile data", () => {
    expect(parseIptc(new Uint8Array(0))).toEqual([])
    expect(parseIptc(new Uint8Array([0x38, 0x42, 0x49, 0x4d, 0x04, 0x04, 0, 0, 0xff, 0xff, 0xff, 0xff]))).toEqual([])
    const bad = new Uint8Array([...new TextEncoder().encode("8BIM"), 0x04, 0x04, 0, 0, 0, 0, 0, 8, 0x1c, 2, 5, 0xff, 0xff, 1, 2, 3])
    expect(parseIptc(bad)).toEqual([])
    // a normal-looking record that claims 20 bytes but only has 3
    const short = new Uint8Array([...new TextEncoder().encode("8BIM"), 0x04, 0x04, 0, 0, 0, 0, 0, 8, 0x1c, 2, 5, 0, 20, 65, 66, 67])
    expect(parseIptc(short)).toEqual([])
  })
})

describe("jpegParts", () => {
  it("finds every place a JPEG can keep metadata", () => {
    const p = jpegParts(fixture("camera-xmp-iptc.jpg"))
    expect(p.exif).not.toBeNull()
    expect(new TextDecoder().decode(p.xmp!)).toContain("Fixture Editor 9")
    expect(p.iptc).not.toBeNull()
    expect(p.comments.map((c) => new TextDecoder().decode(c))).toEqual(["Fixture comment: shot at the secret place"])
    expect(p.size).toEqual({ width: 32, height: 32 })
  })

  it("measures the colour profile, trailing data and the preview", () => {
    expect(jpegParts(fixture("phone-gps.jpg")).iccBytes).toBeGreaterThan(100)
    expect(jpegParts(fixture("trailing-data.jpg")).trailingBytes).toBeGreaterThan(300)
    expect(jpegParts(fixture("no-metadata.jpg"))).toMatchObject({ exif: null, xmp: null, iptc: null, comments: [], iccBytes: 0, trailingBytes: 0 })
  })

  it("lists segments it does not recognise", () => {
    expect(jpegParts(fixture("cmyk-adobe.jpg")).unknownSegments).toEqual([])
  })
})
