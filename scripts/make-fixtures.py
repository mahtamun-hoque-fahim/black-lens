"""Generate JPEG test fixtures with known metadata.

Run from the repo root:  python scripts/make-fixtures.py

Needs: pip install pillow piexif

Why Python and not TypeScript: the fixtures must come from encoders that are
NOT our own parser. If we built test files with our own code, a misreading of
the format would appear on both sides and the tests would still pass. Pillow
and piexif are separate implementations, so agreement means something.

NOTE: the sRGB profile Pillow builds embeds its creation time, so fixtures that carry
an ICC profile (phone-gps.jpg, png-metadata.png) differ byte for byte on every run.
The tests only depend on structure, but do not re-run this casually: it rewrites
committed binaries. Run it only when adding a fixture, then `git checkout` the
files you did not mean to change.

Output goes to src/lib/metadata/__fixtures__/. The images are tiny (32x32
noise) so the files stay small, but the compressed scan data is real.
"""

import io
import os
import random
import struct

import piexif
from PIL import Image, ImageCms

OUT = os.path.join("src", "lib", "metadata", "__fixtures__")
os.makedirs(OUT, exist_ok=True)

random.seed(7)  # same noise every run


def noise_image(mode="RGB", size=(32, 32)):
    img = Image.new(mode, size)
    channels = len(mode)
    data = [
        tuple(random.randrange(256) for _ in range(channels)) if channels > 1 else random.randrange(256)
        for _ in range(size[0] * size[1])
    ]
    img.putdata(data)
    return img


def save(name, data):
    path = os.path.join(OUT, name)
    with open(path, "wb") as f:
        f.write(data)
    print(f"{name}: {len(data)} bytes")


def jpeg_bytes(img, **kwargs):
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85, **kwargs)
    return buf.getvalue()


def segment(marker, payload):
    """Build one marker segment: FF <marker> <len> <payload>."""
    return b"\xff" + bytes([marker]) + struct.pack(">H", len(payload) + 2) + payload


def insert_before_tables(jpeg, extra):
    """Insert segments after the existing APPn segments, before DQT/SOF/etc."""
    pos = 2  # after SOI
    while jpeg[pos] == 0xFF and 0xE0 <= jpeg[pos + 1] <= 0xEF:
        length = struct.unpack(">H", jpeg[pos + 2 : pos + 4])[0]
        pos += 2 + length
    return jpeg[:pos] + extra + jpeg[pos:]


def srgb_icc():
    return ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


def rational(n, d=1):
    return (n, d)


def gps_ifd():
    return {
        piexif.GPSIFD.GPSVersionID: (2, 3, 0, 0),
        piexif.GPSIFD.GPSLatitudeRef: b"N",
        piexif.GPSIFD.GPSLatitude: (rational(22), rational(21), rational(5424, 100)),
        piexif.GPSIFD.GPSLongitudeRef: b"E",
        piexif.GPSIFD.GPSLongitude: (rational(91), rational(49), rational(4812, 100)),
        piexif.GPSIFD.GPSAltitudeRef: 0,
        piexif.GPSIFD.GPSAltitude: rational(1234, 100),
    }


# 1. phone-gps.jpg: Orientation 6, camera, software, dates, GPS, thumbnail, ICC
thumb = jpeg_bytes(noise_image(size=(8, 8)))
phone_exif = {
    "0th": {
        piexif.ImageIFD.Make: b"FixtureCo",
        piexif.ImageIFD.Model: b"Fixture Phone 1",
        piexif.ImageIFD.Software: b"FixtureOS 1.0",
        piexif.ImageIFD.Orientation: 6,
        piexif.ImageIFD.DateTime: b"2026:01:02 03:04:05",
    },
    "Exif": {
        piexif.ExifIFD.DateTimeOriginal: b"2026:01:02 03:04:05",
        piexif.ExifIFD.BodySerialNumber: b"SN-0000-PHONE",
        piexif.ExifIFD.ExifVersion: b"0231",
    },
    "GPS": gps_ifd(),
    "1st": {
        piexif.ImageIFD.Compression: 6,
        piexif.ImageIFD.XResolution: (72, 1),
        piexif.ImageIFD.YResolution: (72, 1),
        piexif.ImageIFD.ResolutionUnit: 2,
    },
    "thumbnail": thumb,
    "Interop": {},
}
phone = jpeg_bytes(noise_image(), exif=piexif.dump(phone_exif), icc_profile=srgb_icc())
save("phone-gps.jpg", phone)

# 2. camera-xmp-iptc.jpg: serials, author, copyright, XMP, IPTC, comment
cam_exif = {
    "0th": {
        piexif.ImageIFD.Make: b"FixtureCam",
        piexif.ImageIFD.Model: b"FC-1",
        piexif.ImageIFD.Artist: b"Fixture Photographer",
        piexif.ImageIFD.Copyright: b"(c) Fixture 2026",
        piexif.ImageIFD.Orientation: 1,
    },
    "Exif": {
        piexif.ExifIFD.BodySerialNumber: b"SN-1111-CAMERA",
        piexif.ExifIFD.LensSerialNumber: b"SN-2222-LENS",
        piexif.ExifIFD.DateTimeOriginal: b"2026:03:04 05:06:07",
    },
    "GPS": {},
    "1st": {},
    "Interop": {},
}
cam = jpeg_bytes(noise_image(), exif=piexif.dump(cam_exif))

xmp = (
    b"http://ns.adobe.com/xap/1.0/\x00"
    b'<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>'
    b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    b'<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" '
    b'xmlns:xmp="http://ns.adobe.com/xap/1.0/">'
    b"<dc:creator>Fixture Photographer</dc:creator>"
    b"<xmp:CreatorTool>Fixture Editor 9</xmp:CreatorTool>"
    b"</rdf:Description></rdf:RDF></x:xmpmeta>"
    b'<?xpacket end="w"?>'
)


def iptc_record(dataset, text):
    data = text.encode("utf-8")
    return b"\x1c\x02" + bytes([dataset]) + struct.pack(">H", len(data)) + data


iptc = (
    iptc_record(5, "Fixture Title")
    + iptc_record(80, "Fixture Photographer")
    + iptc_record(116, "(c) Fixture 2026")
    + iptc_record(120, "Fixture caption text")
    + iptc_record(25, "fixture-keyword")
)
if len(iptc) % 2:
    iptc += b"\x00"
# Photoshop image resource block: "8BIM" + id 0x0404 (IPTC-NAA) + empty pascal name + size + data
irb = b"Photoshop 3.0\x00" + b"8BIM" + struct.pack(">H", 0x0404) + b"\x00\x00" + struct.pack(">I", len(iptc)) + iptc

cam = insert_before_tables(
    cam,
    segment(0xE1, xmp) + segment(0xED, irb) + segment(0xFE, b"Fixture comment: shot at the secret place"),
)
save("camera-xmp-iptc.jpg", cam)

# 3. progressive.jpg: several SOS segments, GPS in EXIF
prog_exif = {
    "0th": {piexif.ImageIFD.Make: b"FixtureCo", piexif.ImageIFD.Orientation: 3},
    "Exif": {},
    "GPS": gps_ifd(),
    "1st": {},
    "Interop": {},
}
save("progressive.jpg", jpeg_bytes(noise_image(size=(64, 64)), progressive=True, exif=piexif.dump(prog_exif)))

# 4. no-metadata.jpg: nothing but structure
save("no-metadata.jpg", jpeg_bytes(noise_image()))

# 5. trailing-data.jpg: phone photo + fake video + a whole second JPEG with GPS (like MPF / motion photo)
trailing = phone + b"\x00\x00\x00\x18ftypmp42" + bytes(random.randrange(256) for _ in range(300)) + cam
save("trailing-data.jpg", trailing)

# 6. corrupt-truncated.jpg: cut in the middle of the scan data
save("corrupt-truncated.jpg", phone[: len(phone) // 2])

# 7. cmyk-adobe.jpg: CMYK has an Adobe APP14 segment that must be kept
cmyk_exif = {
    "0th": {piexif.ImageIFD.Make: b"FixtureCo", piexif.ImageIFD.Orientation: 1},
    "Exif": {},
    "GPS": gps_ifd(),
    "1st": {},
    "Interop": {},
}
save("cmyk-adobe.jpg", jpeg_bytes(noise_image("CMYK"), exif=piexif.dump(cmyk_exif)))

# 8. little-endian.jpg: hand-built "II" EXIF (piexif writes big-endian only)
#    IFD0: Make (ASCII, stored out of line), Orientation 8, GPS pointer
#    GPS IFD: GPSLatitudeRef "N"
make = b"LittleCo\x00"
ifd0_entries = 3
ifd0_size = 2 + ifd0_entries * 12 + 4
make_off = 8 + ifd0_size
gps_off = make_off + len(make)
tiff = b"II*\x00" + struct.pack("<I", 8)
tiff += struct.pack("<H", ifd0_entries)
tiff += struct.pack("<HHII", 0x010F, 2, len(make), make_off)  # Make
tiff += struct.pack("<HHIHH", 0x0112, 3, 1, 8, 0)  # Orientation = 8
tiff += struct.pack("<HHII", 0x8825, 4, 1, gps_off)  # GPSInfo pointer
tiff += struct.pack("<I", 0)
tiff += make
tiff += struct.pack("<H", 1) + struct.pack("<HHI", 0x0001, 2, 2) + b"N\x00\x00\x00" + struct.pack("<I", 0)
le = insert_before_tables(jpeg_bytes(noise_image()), segment(0xE1, b"Exif\x00\x00" + tiff))
save("little-endian.jpg", le)


# ---------------------------------------------------------------------------
# PNG fixtures. Chunks are built here with zlib.crc32, independent of our parser.
# ---------------------------------------------------------------------------
import zlib


def png_chunk(ctype, data):
    return struct.pack(">I", len(data)) + ctype + data + struct.pack(">I", zlib.crc32(ctype + data) & 0xFFFFFFFF)


def insert_after_ihdr(png, extra):
    ihdr_end = 8 + 12 + 13  # signature + (length, type, 13 data bytes, crc)
    return png[:ihdr_end] + extra + png[ihdr_end:]


def insert_before_iend(png, extra):
    return png[:-12] + extra + png[-12:]  # IEND is always the last 12 bytes of a clean Pillow file


def png_bytes(img, **kwargs):
    buf = io.BytesIO()
    img.save(buf, "PNG", **kwargs)
    return buf.getvalue()


def text(keyword, value):
    return png_chunk(b"tEXt", keyword.encode("latin-1") + b"\x00" + value.encode("latin-1"))


# 9. png-metadata.png: every kind of identifying chunk, plus parts that must stay
meta_exif = piexif.dump(
    {
        "0th": {
            piexif.ImageIFD.Make: b"FixtureCo",
            piexif.ImageIFD.Model: b"Fixture Phone 1",
            piexif.ImageIFD.Orientation: 6,
        },
        "Exif": {
            piexif.ExifIFD.DateTimeOriginal: b"2026:01:02 03:04:05",
            piexif.ExifIFD.BodySerialNumber: b"SN-0000-PHONE",
        },
        "GPS": gps_ifd(),
        "1st": {},
        "Interop": {},
    }
)[6:]  # drop "Exif\0\0": PNG stores the bare TIFF structure
xmp_itxt = (
    b"XML:com.adobe.xmp\x00\x00\x00\x00\x00"  # keyword, NUL, compression flag 0, method 0, empty language, empty translated keyword
    + b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    b'<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>Fixture Editor 9</xmp:CreatorTool>'
    b"</rdf:Description></rdf:RDF></x:xmpmeta>"
)
base = png_bytes(noise_image(), icc_profile=srgb_icc(), dpi=(300, 300))
before = (
    png_chunk(b"gAMA", struct.pack(">I", 45455))
    + text("Author", "Fixture Photographer")
    + text("Software", "FixtureOS 1.0")
    + text("Copyright", "(c) Fixture 2026")
    + text("Comment", "Fixture comment: shot at the secret place")
    + png_chunk(b"zTXt", b"Description\x00\x00" + zlib.compress(b"Fixture caption text"))
    + png_chunk(b"iTXt", xmp_itxt)
    + png_chunk(b"eXIf", meta_exif)
)
after = png_chunk(b"tIME", struct.pack(">HBBBBB", 2026, 1, 2, 3, 4, 5)) + text("Creation Time", "2026:01:02 03:04:05")
png_meta = insert_before_iend(insert_after_ihdr(base, before), after)
save("png-metadata.png", png_meta)

# 10. png-palette-trns.png: indexed colour with transparency (PLTE + tRNS must survive)
pal = Image.new("P", (32, 32))
pal.putpalette([random.randrange(256) for _ in range(768)])
pal.putdata([random.randrange(16) for _ in range(32 * 32)])
pal_exif = piexif.dump({"0th": {piexif.ImageIFD.Make: b"FixtureCam", piexif.ImageIFD.Orientation: 3}, "Exif": {}, "GPS": {}, "1st": {}, "Interop": {}})[6:]
save(
    "png-palette-trns.png",
    insert_after_ihdr(png_bytes(pal, transparency=0), text("Author", "Fixture Photographer") + png_chunk(b"eXIf", pal_exif)),
)

# 11. png-rgba.png: alpha channel plus a text chunk, no EXIF at all
rgba = noise_image("RGBA")
rgba_png = insert_after_ihdr(png_bytes(rgba), text("Software", "Fixture Editor 9"))
save("png-rgba.png", rgba_png)

# 12. png-little-endian-exif.png: eXIf written in "II" byte order (reuses the TIFF built for the JPEG fixture)
save("png-little-endian-exif.png", insert_after_ihdr(png_bytes(noise_image()), png_chunk(b"eXIf", tiff)))

# 13. png-trailing.png: a metadata PNG, fake video bytes, then a whole second PNG
save("png-trailing.png", png_meta + b"\x00\x00\x00\x18ftypmp42" + bytes(random.randrange(256) for _ in range(200)) + rgba_png)

# 14. png-animated.png: APNG (acTL, fcTL, fdAT must survive) with an author chunk
frames = [noise_image(size=(32, 32)) for _ in range(3)]
apng = png_bytes(frames[0], save_all=True, append_images=frames[1:], duration=100, loop=0)
save("png-animated.png", insert_after_ihdr(apng, text("Author", "Fixture Photographer")))

# 15. png-clean.png: nothing but IHDR, IDAT, IEND
save("png-clean.png", png_bytes(noise_image()))

# 16. png-corrupt.png: cut in half
save("png-corrupt.png", png_meta[: len(png_meta) // 2])

# 17. png-unknown-critical.png: an uppercase chunk we do not understand
save("png-unknown-critical.png", insert_after_ihdr(png_bytes(noise_image()), png_chunk(b"ABCD", b"mystery")))


# ---------------------------------------------------------------------------
# WebP fixtures. RIFF container, little-endian, no checksums.
# ---------------------------------------------------------------------------
def webp_parse(d):
    size = struct.unpack("<I", d[4:8])[0]
    end = 8 + size
    out, pos = [], 12
    while pos < end:
        t = d[pos : pos + 4]
        n = struct.unpack("<I", d[pos + 4 : pos + 8])[0]
        out.append((t, d[pos + 8 : pos + 8 + n]))
        pos += 8 + n + (n & 1)
    return out


def webp_build(chunks):
    body = b"WEBP"
    for t, p in chunks:
        body += t + struct.pack("<I", len(p)) + p + (b"\x00" if len(p) & 1 else b"")
    return b"RIFF" + struct.pack("<I", len(body)) + body


def webp_bytes(img, **kwargs):
    buf = io.BytesIO()
    img.save(buf, "WEBP", **kwargs)
    return buf.getvalue()


webp_xmp = (
    b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    b'<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>Fixture Editor 9</xmp:CreatorTool>'
    b"</rdf:Description></rdf:RDF></x:xmpmeta>"
)

# 18. webp-metadata.webp: VP8X + ICCP + VP8 + EXIF + XMP, plus an unknown vendor chunk
wm = webp_parse(webp_bytes(noise_image(), quality=80, exif=meta_exif, xmp=webp_xmp, icc_profile=srgb_icc()))
webp_meta = webp_build(wm + [(b"FXTR", b"FixtureOS unknown vendor data")])
save("webp-metadata.webp", webp_meta)

# 19. webp-lossless-alpha.webp: VP8L (alpha inside), EXIF with Orientation 3, XMP
save("webp-lossless-alpha.webp", webp_bytes(noise_image("RGBA"), lossless=True, exif=pal_exif, xmp=webp_xmp))

# 20. webp-alpha-lossy.webp: ALPH + VP8 (separate alpha chunk), XMP only
save("webp-alpha-lossy.webp", webp_bytes(noise_image("RGBA"), quality=80, xmp=webp_xmp))

# 21. webp-simple.webp: RIFF + VP8, no VP8X, cannot hold metadata
webp_simple = webp_bytes(noise_image(), quality=80)
save("webp-simple.webp", webp_simple)

# 22. webp-animated.webp: ANIM + 3 ANMF frames, metadata, and an unknown sub-chunk hidden inside frame 1
wa = webp_parse(
    webp_bytes(
        noise_image(size=(32, 32)),
        save_all=True,
        append_images=[noise_image(size=(32, 32)), noise_image(size=(32, 32))],
        duration=100,
        loop=0,
        lossless=True,
        exif=meta_exif,
        xmp=webp_xmp,
        icc_profile=srgb_icc(),
    )
)
patched, done = [], False
for t, p in wa:
    if t == b"ANMF" and not done:
        sub = b"FXTR" + struct.pack("<I", 20) + b"FixtureCo hidden data"[:20]
        p = p + sub + (b"\x00" if 20 & 1 else b"")
        done = True
    patched.append((t, p))
save("webp-animated.webp", webp_build(patched))

# 23. webp-trailing.webp: a metadata WebP, fake video bytes after the RIFF size, then a whole second WebP
save("webp-trailing.webp", webp_meta + b"\x00\x00\x00\x18ftypmp42" + bytes(random.randrange(256) for _ in range(200)) + webp_simple)

# 24. webp-little-endian-exif.webp: the little-endian TIFF built for the JPEG fixture
save("webp-little-endian-exif.webp", webp_bytes(noise_image(), quality=80, exif=tiff))

# 25. webp-corrupt.webp: cut in half
save("webp-corrupt.webp", webp_meta[: len(webp_meta) // 2])

# 26. webp-reserved-bits.webp: VP8X with a reserved flag bit and reserved bytes used to hide data
wr = webp_parse(webp_bytes(noise_image("RGBA"), quality=80))
assert wr[0][0] == b"VP8X"
x = bytearray(wr[0][1])
x[0] |= 0x01  # reserved flag bit
x[1:4] = b"FXT"  # reserved bytes
save("webp-reserved-bits.webp", webp_build([(b"VP8X", bytes(x))] + wr[1:]))
