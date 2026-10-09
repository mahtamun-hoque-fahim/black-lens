"""Derive extra fixtures from fixtures that are already committed.

Run from the repo root:  python scripts/make-derived-fixtures.py

Unlike make-fixtures.py this reads files from disk and generates nothing random, so it is safe to
re-run: it never rewrites the fixtures that embed a timestamped ICC profile.
"""

import os
import struct

OUT = os.path.join("src", "lib", "metadata", "__fixtures__")


def save(name, data):
    with open(os.path.join(OUT, name), "wb") as f:
        f.write(data)
    print(f"{name}: {len(data)} bytes")


# webp-pad-bytes.webp: the pad byte after the odd-sized ALPH chunk carries a payload byte.
# RIFF pads every odd-sized chunk with one zero byte; a dirty pad byte is a place to hide data.
d = bytearray(open(os.path.join(OUT, "webp-alpha-lossy.webp"), "rb").read())
end, pos = 8 + struct.unpack("<I", d[4:8])[0], 12
while pos < end:
    n = struct.unpack("<I", d[pos + 4 : pos + 8])[0]
    if d[pos : pos + 4] == b"ALPH" and n & 1:
        assert d[pos + 8 + n] == 0, "pad byte should start as zero"
        d[pos + 8 + n] = 0x46  # 'F'
        break
    pos += 8 + n + (n & 1)
else:
    raise SystemExit("no odd-sized ALPH chunk found in webp-alpha-lossy.webp")
save("webp-pad-bytes.webp", bytes(d))


# ---------------------------------------------------------------------------
# ZIP fixtures, made with Python's zipfile (independent of our reader and writer).
# A fixed timestamp keeps the output deterministic.
# ---------------------------------------------------------------------------
import io
import zipfile

FIXED = (1980, 1, 1, 0, 0, 0)


def read(name):
    return open(os.path.join(OUT, name), "rb").read()


def make_zip(entries, method):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, data in entries:
            info = zipfile.ZipInfo(name, FIXED)
            info.compress_type = method
            z.writestr(info, data)
    return buf.getvalue()


photos = [
    ("a.jpg", read("phone-gps.jpg")),
    ("nested/", b""),
    ("nested/b.png", read("png-metadata.png")),
    ("nested/deeper/c.webp", read("webp-metadata.webp")),
    ("__MACOSX/._a.jpg", b"AppleDouble junk"),
    ("notes.txt", b"not a photo"),
]
zip_store = make_zip(photos, zipfile.ZIP_STORED)
save("zip-store.zip", zip_store)
save("zip-deflate.zip", make_zip(photos, zipfile.ZIP_DEFLATED))

# a zip bomb: 20 MB of zeros that deflate to a few KB
save("zip-bomb.zip", make_zip([("bomb.jpg", b"\x00" * (20 * 1024 * 1024))], zipfile.ZIP_DEFLATED))

# encrypted: set the "encrypted" flag bit in the local header and the central directory header
enc = bytearray(zip_store)
enc[6] |= 0x01
cd = enc.index(b"PK\x01\x02")
enc[cd + 8] |= 0x01
save("zip-encrypted.zip", bytes(enc))

# stored data with one flipped byte, so the CRC-32 no longer matches
bad = bytearray(zip_store)
bad[30 + len("a.jpg") + 40] ^= 0xFF
save("zip-bad-crc.zip", bytes(bad))

# cut off before the end-of-central-directory record
save("zip-truncated.zip", zip_store[: len(zip_store) * 6 // 10])

# awkward names: path traversal, a backslash, non-ASCII, and a duplicate
clean_jpg, clean_png = read("no-metadata.jpg"), read("png-clean.png")
save(
    "zip-names.zip",
    make_zip(
        [
            ("../../evil.jpg", clean_jpg),
            ("dir\\back.png", clean_png),
            ("caf\u00e9.jpg", clean_jpg),
            ("dup.jpg", clean_jpg),
            ("dup.jpg", clean_png),
        ],
        zipfile.ZIP_STORED,
    ),
)


# ---------------------------------------------------------------------------
# Non-square images. Every earlier fixture is 32x32, which cannot tell width from height.
# ---------------------------------------------------------------------------
import random as _random

from PIL import Image


def wide_image():
    rnd = _random.Random(11)
    img = Image.new("RGB", (48, 16))
    img.putdata([(rnd.randrange(256), rnd.randrange(256), rnd.randrange(256)) for _ in range(48 * 16)])
    return img


def encode(img, fmt, **kw):
    b = io.BytesIO()
    img.save(b, fmt, **kw)
    return b.getvalue()


save("wide.jpg", encode(wide_image(), "JPEG", quality=85))
save("wide.png", encode(wide_image(), "PNG"))
save("wide-lossy.webp", encode(wide_image(), "WEBP", quality=80))  # simple file: RIFF + VP8
save("wide-lossless.webp", encode(wide_image(), "WEBP", lossless=True))  # simple file: RIFF + VP8L
save("wide-extended.webp", encode(wide_image(), "WEBP", quality=80, xmp=b"<x:xmpmeta/>"))  # VP8X canvas
