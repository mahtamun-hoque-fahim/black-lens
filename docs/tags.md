# Tag mode: what is written, and where

Written before any tag-writing code, as the format specs were for Clean (Council PRE-BUILD condition 1).

## The rule

Tag = **Clean, then write**. The photo is cleaned exactly as Clean does it (same code, same verifier), and then only the fields the person filled in are added. Nothing from the original survives except what Clean keeps: Orientation and the colour profile (unless removed).

Because the two steps are separate, the writers only ever see an already-clean file, and Clean's own check runs on step one unchanged.

## The six fields

| Field | Meaning | Limit | Notes |
|---|---|---|---|
| Artist | Who made the photo | 200 characters | One line |
| Copyright | Rights statement | 500 characters | One line, for example `(c) 2026 Jane Roe. All rights reserved.` |
| Title | Short name of the photo | 200 characters | One line |
| Description | A caption | 2000 characters | May have line breaks |
| Keywords | Search words | 50 words, 100 characters each | Typed separated by commas; duplicates removed |
| Date | The date to stamp as "created" | `YYYY-MM-DD`, 1900 to 2100, a real calendar date | A date only. No time is invented |

An empty field is not written. If every field is empty there is nothing to tag, and the button says so.

## Cleaning up what was typed

Applied once, before anything is written (`normalizeTags`):

- Unicode is normalised to NFC, so `e` + accent and the single accented letter are the same text.
- Control characters are removed (tab and line break survive only in Description), lone surrogates become U+FFFD, and runs of spaces in one-line fields collapse to one.
- Leading and trailing space is trimmed.
- Over-length text is **rejected with a plain message, not silently cut**: a copyright notice that loses its last words is worse than an error.

## Where each field goes

All text is UTF-8 in XMP and the PNG text chunks. EXIF stores text as 7-bit ASCII by specification, so the EXIF copy is written **only when the text is plain printable ASCII**; otherwise EXIF is left without that field and XMP carries it. Nothing is ever transliterated or mangled to fit.

| Field | JPEG | PNG | WebP |
|---|---|---|---|
| Artist | XMP `dc:creator`; EXIF IFD0 `Artist` (0x013B) if ASCII | iTXt `Author`; XMP `dc:creator`; eXIF `Artist` if ASCII | XMP `dc:creator`; EXIF `Artist` if ASCII |
| Copyright | XMP `dc:rights`; EXIF `Copyright` (0x8298) if ASCII | iTXt `Copyright`; XMP `dc:rights`; eXIF `Copyright` if ASCII | XMP `dc:rights`; EXIF `Copyright` if ASCII |
| Title | XMP `dc:title` | iTXt `Title`; XMP `dc:title` | XMP `dc:title` |
| Description | XMP `dc:description`; EXIF `ImageDescription` (0x010E) if ASCII | iTXt `Description`; XMP `dc:description`; eXIf `ImageDescription` if ASCII | XMP `dc:description`; EXIF `ImageDescription` if ASCII |
| Keywords | XMP `dc:subject` (a bag) | XMP `dc:subject` | XMP `dc:subject` |
| Date | XMP `xmp:CreateDate` (`2026-01-02`); EXIF `DateTimeOriginal` (0x9003) as `2026:01:02 00:00:00` | iTXt `Creation Time` (`2026-01-02`); XMP; eXIf `DateTimeOriginal` | XMP; EXIF `DateTimeOriginal` |

Keywords live in XMP only. Windows' own keyword field (`XPKeywords`) and IPTC are not written: neither adds a reader that XMP does not already reach, and both add more places for text to go wrong.

## XMP

One packet, UTF-8, wrapped in the usual `<?xpacket ... ?>` markers, built only from the tagged fields. **Every value is XML-escaped** (`&`, `<`, `>`, `"`, `'`), so text such as `Fish & Chips <b>` or `]]>` can never break the packet or inject markup. The packet is at most 60 KB so it fits a JPEG APP1 segment (65,533 bytes) with room to spare. It contains no tool name, no edit history and no unique ID: Black Lens does not write itself into the photo.

## Per format

**JPEG.** The clean file already has an orientation-only EXIF APP1 right after JFIF. It is replaced by a fuller EXIF block (Orientation, plus the ASCII fields), and an XMP APP1 is added directly after it. Nothing else changes; the scan data is not touched.

**PNG.** The orientation-only `eXIf` chunk right after `IHDR` is replaced by a fuller one; the `iTXt` chunks and the XMP `iTXt` follow it. All of these sit before `IDAT`, which the PNG rules allow. Each new chunk gets a real CRC-32.

**WebP.** Metadata needs the extended layout. A file that already has a `VP8X` header gets its `EXIF` chunk replaced and an `XMP ` chunk added, with the flags and `RIFF` size rewritten. A **simple** file (`RIFF` + `VP8 ` or `VP8L` only) has no `VP8X`, so one is added: canvas size read from the image header, the alpha flag set from the lossless header's alpha bit, then the EXIF and XMP flags. The image chunks are copied byte for byte.

## Checking the result

After writing, the file is read again from scratch with the same reader View uses, and three things must hold or no file is returned:

1. **Clean first.** The cleaned intermediate passed Clean's own check.
2. **Only what was asked.** Every value the reader finds (outside the Picture group) is one of the tagged values; nothing from the original, no software name, no location, no camera. No field shows up under Hidden extras.
3. **All of it, intact.** Every tagged value is read back exactly as normalised.

And as for Clean, the image data (tables, frame header, scans; for WebP the pixel chunks and the canvas size) must be byte-identical to the input.

## Presets

A preset is a name plus the six fields, saved in this browser's `localStorage` and nowhere else. Storage can be blocked or full (private windows, strict settings), so every read and write is wrapped and the form keeps working without presets. A preset is never sent anywhere.
