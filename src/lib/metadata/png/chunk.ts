import { crc32 } from "../../crc32"
import { buildOrientationTiff } from "../exif"

export { crc32 }

/** length (4) + type (4) + data + CRC (4), all big-endian. */
export function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** An eXIf chunk holding exactly one tag, Orientation. 38 bytes; layout in docs/formats/png.md. */
export function buildOrientationChunk(orientation: number): Uint8Array {
  return buildChunk("eXIf", buildOrientationTiff(orientation))
}
