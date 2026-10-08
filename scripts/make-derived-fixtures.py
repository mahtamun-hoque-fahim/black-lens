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
