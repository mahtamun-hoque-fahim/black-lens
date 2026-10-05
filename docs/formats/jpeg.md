# JPEG segment map

Written before the stripper, as Council PRE-BUILD condition 1 requires. The code in `src/lib/metadata/jpeg/` must match this table. If the code and this file disagree, one of them is a bug.

## How a JPEG file is laid out

A JPEG is a flat list of segments. Almost every segment is:

```
0xFF  <marker byte>  <length: 2 bytes, big-endian>  <payload: length - 2 bytes>
```

The length includes its own 2 bytes but not the `0xFF <marker>` pair. Two markers have no length and no payload: `SOI` (`FF D8`, start of image) and `EOI` (`FF D9`, end of image). `RSTn` (`FF D0` to `FF D7`) and `TEM` (`FF 01`) are also bare.

The one trap is the scan. After a `SOS` segment (`FF DA`) the compressed pixels follow with no length field. They run until the next real marker. Inside that run, a literal `0xFF` data byte is always written as `FF 00` ("byte stuffing"), so a marker is any `FF` followed by something that is neither `00` nor `D0` to `D7`. Progressive JPEGs have several `SOS` segments, with `DHT` tables between them, so a reader cannot stop at the first scan.

Metadata lives in the `APPn` segments (`FF E0` to `FF EF`) and in `COM` (`FF FE`). The decoder ignores them. That is why they can be removed without touching a single pixel.

## Rule: default deny

The stripper keeps a short allow-list and drops everything else. A new vendor segment we have never heard of is removed, not kept. The claim is "all identifying metadata removed", so the safe failure is losing something harmless, never keeping something unknown.

## Segment table

| Marker | Name | Action | Why |
|---|---|---|---|
| `FF D8` | SOI | keep | Structure |
| `FF D9` | EOI | keep | Structure; marks the end of the image |
| `FF DB` | DQT | keep | Quantisation tables, needed to decode |
| `FF C4` | DHT | keep | Huffman tables, needed to decode |
| `FF C0` to `FF CF` except `C4`, `C8`, `CC` | SOFn | keep | Frame header: size, precision, components |
| `FF CC` | DAC | keep | Arithmetic coding conditioning |
| `FF DD` | DRI | keep | Restart interval, needed to decode |
| `FF DA` + scan data | SOS | keep, byte for byte | The pixels |
| `FF D0` to `FF D7` | RSTn | keep | Inside scan data, needed to decode |
| `FF DC` | DNL | keep | Line count, needed to decode |
| `FF E0` `JFIF\0` | APP0 JFIF | keep, rewritten without thumbnail | Structure (version, density). The embedded thumbnail is a second picture and is dropped |
| `FF E0` `JFXX\0` | APP0 JFXX | remove | Extension thumbnails |
| `FF E1` `Exif\0\0` | APP1 EXIF | **replace** | Remove everything. If the original had a valid Orientation (1 to 8), write a new 32-byte EXIF block holding only that tag |
| `FF E1` `http://ns.adobe.com/xap/1.0/\0` | APP1 XMP | remove | Author, edit history, tool names, sometimes GPS |
| `FF E1` other | APP1 other | remove | Unknown |
| `FF E2` `ICC_PROFILE\0` | APP2 ICC | keep (switch can remove) | Colour profile; without it colours shift. All chunks of a split profile are kept together |
| `FF E2` `MPF\0` | APP2 MPF | remove | Multi-Picture Format index. Points at extra embedded photos (previews, HDR gain maps) |
| `FF E2` `FPXR\0` | APP2 FlashPix | remove | Vendor data |
| `FF E2` other | APP2 other | remove | Unknown |
| `FF ED` `Photoshop 3.0\0` | APP13 | remove | IPTC caption, byline, keywords, copyright, Photoshop edit data |
| `FF EE` `Adobe` | APP14 | keep | Holds the colour transform flag; CMYK and YCCK images decode wrongly without it |
| `FF E3` to `FF EC`, `FF EF` | APPn other | remove | Maker notes, Samsung and Ricoh blocks, Ducky, Picture Info, and so on |
| `FF FE` | COM | remove | Free text comments |
| `FF F0` to `FF FD` | JPGn | remove | Reserved |
| `FF 01` | TEM | remove | Reserved |
| anything after the final `EOI` | trailing data | remove | Motion Photo video, second JPEGs, hidden payloads |

## Orientation, in bytes

The EXIF block is a small TIFF file inside the `APP1` payload:

```
45 78 69 66 00 00        "Exif" + 2 zero bytes
4D 4D 00 2A              byte order ("MM" = big-endian, "II" = little-endian) + magic 42
00 00 00 08              offset of IFD0, counted from the byte-order mark
00 01                    IFD0 has 1 entry
01 12  00 03  00 00 00 01  00 06 00 00     tag 0x0112, type SHORT, count 1, value 6
00 00 00 00              offset of the next IFD: none
```

That is exactly what the stripper writes: 6 + 8 + 2 + 12 + 4 = 32 bytes, so the `APP1` segment is 2 + 2 + 32 = 36 bytes on disk. Orientation 6 means "rotate 90 degrees clockwise to display". Removing it would leave a phone photo lying on its side, which is why Clean keeps it. The source file may be little-endian; the reader handles both, the writer always writes big-endian.

## What "identifying" means for the verifier

After stripping, the re-read check must find nothing except:

- structural segments from the table
- one ICC profile, if the switch is off
- an EXIF block with exactly one tag, 0x0112 Orientation
- zero trailing bytes after `EOI`

Anything else is a failure, even a segment this document does not list.

## Known trade-offs

- Removing `MPF` and trailing data drops Ultra HDR and Apple gain maps. The photo still displays, as the standard-range version.
- Removing the JFIF thumbnail changes the file size, not the picture.
- XMP can also hold an orientation value. We ignore it; EXIF is the one viewers obey.

## Fixtures

Generated by `scripts/make-fixtures.py` (Pillow and piexif, independent of our parser). See `src/lib/metadata/__fixtures__/`.
