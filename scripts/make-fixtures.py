"""Generate JPEG test fixtures with known metadata.

Run from the repo root:  python scripts/make-fixtures.py

Needs: pip install pillow piexif

Why Python and not TypeScript: the fixtures must come from encoders that are
NOT our own parser. If we built test files with our own code, a misreading of
the format would appear on both sides and the tests would still pass. Pillow
and piexif are separate implementations, so agreement means something.

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
