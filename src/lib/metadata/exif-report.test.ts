// @vitest-environment node
import { describe, expect, it } from "vitest"
import { readExifFields, type ExifField, type ExifFields } from "./exif"
import { describeExif } from "./exif-report"
import { exifTiff } from "./test-utils"

const field = (ifd: ExifField["ifd"], tag: number, type: number, value: ExifField["value"], extra: Partial<ExifField> = {}): ExifField => ({
  ifd,
  tag,
  type,
  count: Array.isArray(value) ? value.length : 1,
  size: 0,
  value,
  ...extra,
})
const fields = (...f: ExifField[]): ExifFields => ({ byteOrder: "MM", fields: f })
const get = (r: ReturnType<typeof describeExif>, label: string) => r.fields.find((x) => x.label === label)
const text = (s: string) => new TextEncoder().encode(s)

describe("describeExif on real files", () => {
  it("describes the phone photo", () => {
    const r = describeExif(readExifFields(exifTiff("phone-gps.jpg")!)!)
    expect(get(r, "Make")).toMatchObject({ group: "camera", value: "FixtureCo", source: "EXIF" })
    expect(get(r, "Model")!.value).toBe("Fixture Phone 1")
    expect(get(r, "Camera serial number")).toMatchObject({ group: "camera", value: "SN-0000-PHONE" })
    expect(get(r, "Software")).toMatchObject({ group: "software", value: "FixtureOS 1.0" })
    expect(get(r, "Taken")).toMatchObject({ group: "dates", value: "2026-01-02 03:04:05" })
    expect(get(r, "Last changed")!.value).toBe("2026-01-02 03:04:05")
    expect(get(r, "Orientation")).toMatchObject({ group: "picture", value: "Rotated 90 degrees clockwise" })
    expect(get(r, "Coordinates")).toMatchObject({ group: "location", value: "22.365067, 91.830033" })
    expect(get(r, "Latitude")!.value).toBe(`22° 21' 54.24" N`)
    expect(get(r, "Longitude")!.value).toBe(`91° 49' 48.12" E`)
    expect(get(r, "Altitude")!.value).toBe("12.34 m above sea level")
    expect(get(r, "Embedded preview image")).toMatchObject({ group: "extras" })
    expect(get(r, "Embedded preview image")!.value).toMatch(/\d+ bytes/)
    expect(r.location).toEqual({ latitude: expect.closeTo(22.365067, 6), longitude: expect.closeTo(91.830033, 6), altitude: expect.closeTo(12.34, 5), text: "22.365067, 91.830033" })
  })

  it("describes author, copyright and serial numbers in the camera photo", () => {
    const r = describeExif(readExifFields(exifTiff("camera-xmp-iptc.jpg")!)!)
    expect(get(r, "Artist")).toMatchObject({ group: "author", value: "Fixture Photographer" })
    expect(get(r, "Copyright")).toMatchObject({ group: "author", value: "(c) Fixture 2026" })
    expect(get(r, "Lens serial number")!.value).toBe("SN-2222-LENS")
    expect(r.location).toBeNull()
  })

  it("reads a little-endian file", () => {
    const r = describeExif(readExifFields(exifTiff("little-endian.jpg")!)!)
    expect(get(r, "Make")!.value).toBe("LittleCo")
    expect(get(r, "Orientation")!.value).toBe("Rotated 90 degrees anticlockwise")
  })
})

describe("coordinates", () => {
  const gps = (latRef: string, lat: number[], lonRef: string, lon: number[], ...more: ExifField[]) =>
    fields(field("gps", 1, 2, latRef), field("gps", 2, 5, lat), field("gps", 3, 2, lonRef), field("gps", 4, 5, lon), ...more)

  it("makes south and west negative", () => {
    const r = describeExif(gps("S", [33, 52, 4], "W", [151, 12, 36]))
    expect(r.location!.latitude).toBeLessThan(0)
    expect(r.location!.longitude).toBeLessThan(0)
    expect(r.location!.text).toBe("-33.867778, -151.21")
    expect(get(r, "Latitude")!.value).toBe(`33° 52' 4" S`)
    expect(get(r, "Longitude")!.value).toBe(`151° 12' 36" W`)
  })

  it("says below sea level when the reference says so", () => {
    const r = describeExif(gps("N", [31, 30, 0], "E", [35, 28, 0], field("gps", 5, 1, 1), field("gps", 6, 5, 430.5)))
    expect(get(r, "Altitude")!.value).toBe("430.5 m below sea level")
    expect(r.location!.altitude).toBe(-430.5)
  })

  it("accepts degrees written as a decimal with zero minutes and seconds", () => {
    expect(describeExif(gps("N", [22.5, 0, 0], "E", [91.25, 0, 0])).location!.text).toBe("22.5, 91.25")
  })

  it("reports GPS tags it cannot read instead of silently showing nothing", () => {
    const r = describeExif(fields(field("gps", 1, 2, "N"), field("gps", 2, 5, null), field("gps", 3, 2, "E"), field("gps", 4, 5, null)))
    expect(r.location).toBeNull()
    expect(get(r, "GPS data")).toMatchObject({ group: "location", value: "Present, but it could not be read" })
  })

  it("rejects coordinates that cannot exist", () => {
    const r = describeExif(gps("N", [95, 0, 0], "E", [10, 0, 0]))
    expect(r.location).toBeNull()
    expect(get(r, "GPS data")).toBeDefined()
  })

  it("shows the GPS clock, the direction the camera pointed, and the speed", () => {
    const r = describeExif(
      gps("N", [1, 0, 0], "E", [1, 0, 0], field("gps", 7, 5, [3, 4, 5]), field("gps", 0x1d, 2, "2026:01:02"), field("gps", 0x10, 2, "T"), field("gps", 0x11, 5, 270.5), field("gps", 0xc, 2, "K"), field("gps", 0xd, 5, 12)),
    )
    expect(get(r, "GPS time")!.value).toBe("2026-01-02 03:04:05 UTC")
    expect(get(r, "Direction")!.value).toBe("270.5 degrees from true north")
    expect(get(r, "Speed")!.value).toBe("12 km/h")
  })

  it("shows a named place the camera recorded", () => {
    const r = describeExif(gps("N", [1, 0, 0], "E", [1, 0, 0], field("gps", 0x1c, 7, new Uint8Array([...text("ASCII\0\0\0"), ...text("Old harbour")]))))
    expect(get(r, "Place name")!.value).toBe("Old harbour")
  })
})

describe("camera settings", () => {
  const r = describeExif(
    fields(
      field("exif", 0x829a, 5, 0.004, { rationals: [[1, 250]] }),
      field("exif", 0x829d, 5, 2.8),
      field("exif", 0x8827, 3, 400),
      field("exif", 0x920a, 5, 4.25),
      field("exif", 0xa405, 3, 26),
      field("exif", 0xa434, 2, "Fixture 4.2mm lens"),
    ),
  )
  it("formats them the way photographers read them", () => {
    expect(get(r, "Exposure time")!.value).toBe("1/250 s")
    expect(get(r, "Aperture")!.value).toBe("f/2.8")
    expect(get(r, "ISO")!.value).toBe("400")
    expect(get(r, "Focal length")!.value).toBe("4.3 mm")
    expect(get(r, "Focal length (35mm equivalent)")!.value).toBe("26 mm")
    expect(get(r, "Lens")!.value).toBe("Fixture 4.2mm lens")
  })
  it("writes long exposures in seconds", () => {
    expect(get(describeExif(fields(field("exif", 0x829a, 5, 2.5, { rationals: [[5, 2]] }))), "Exposure time")!.value).toBe("2.5 s")
    expect(get(describeExif(fields(field("exif", 0x829a, 5, 0.3333, { rationals: [[3333, 10000]] }))), "Exposure time")!.value).toBe("1/3 s")
  })
})

describe("text fields", () => {
  it("decodes a UserComment with its 8-byte character set prefix", () => {
    const ascii = field("exif", 0x9286, 7, new Uint8Array([...text("ASCII\0\0\0"), ...text("hello there")]))
    expect(get(describeExif(fields(ascii)), "User comment")).toMatchObject({ group: "notes", value: "hello there" })
    const unicode = field("exif", 0x9286, 7, new Uint8Array([...text("UNICODE\0"), 0x00, 0x68, 0x00, 0x69])) // "hi", big-endian like the file
    expect(get(describeExif(fields(unicode)), "User comment")!.value).toBe("hi")
  })

  it("decodes the Windows (XP) fields, which are UTF-16 stored as bytes", () => {
    const utf16 = (s: string) => Array.from(s + "\0").flatMap((c) => [c.charCodeAt(0), 0])
    const r = describeExif(fields(field("ifd0", 0x9c9d, 1, utf16("Jane Roe")), field("ifd0", 0x9c9c, 1, utf16("windows note"))))
    expect(get(r, "Author (Windows)")).toMatchObject({ group: "author", value: "Jane Roe" })
    expect(get(r, "Comment (Windows)")).toMatchObject({ group: "notes", value: "windows note" })
  })

  it("leaves a date it does not understand exactly as written", () => {
    expect(get(describeExif(fields(field("exif", 0x9003, 2, "yesterday-ish"))), "Taken")!.value).toBe("yesterday-ish")
    expect(get(describeExif(fields(field("exif", 0x9003, 2, "0000:00:00 00:00:00"))), "Taken")!.value).toBe("0000:00:00 00:00:00")
  })

  it("does not show empty values", () => {
    expect(describeExif(fields(field("ifd0", 0x010f, 2, ""), field("ifd0", 0x0110, 2, null))).fields).toEqual([])
  })
})

describe("picture and extras", () => {
  it("combines resolution tags", () => {
    const r = describeExif(fields(field("ifd0", 0x011a, 5, 300), field("ifd0", 0x011b, 5, 300), field("ifd0", 0x0128, 3, 2)))
    expect(get(r, "Resolution")).toMatchObject({ group: "picture", value: "300 x 300 pixels per inch" })
  })

  it("sizes up maker notes without printing them", () => {
    const r = describeExif(fields(field("exif", 0x927c, 7, new Uint8Array(40), { size: 40 })))
    expect(get(r, "Camera maker notes")).toMatchObject({ group: "extras", value: "40 bytes of private camera data" })
  })

  it("counts the technical tags it does not show, so nothing is silently hidden", () => {
    const r = describeExif(fields(field("ifd0", 0xc000, 4, 1), field("exif", 0xc001, 4, 2), field("exif", 0x9000, 7, text("0231"))))
    expect(get(r, "Other technical tags")).toMatchObject({ group: "extras", value: "2 tags" })
  })
})
