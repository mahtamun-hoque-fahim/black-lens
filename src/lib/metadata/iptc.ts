import type { GroupId, ReportField } from "./report-types"

/**
 * IPTC: captions, credits and keywords written by photo software. In a JPEG it sits inside a
 * Photoshop "image resource block" (APP13): a list of "8BIM" resources, one of which (0x0404)
 * holds the IPTC records. Every length is checked before it is trusted; bad data returns nothing.
 */

type Row = [group: GroupId, label: string]

// Record 2 ("application") datasets we know how to label.
const DATASETS: Record<number, Row> = {
  5: ["notes", "Title"],
  25: ["notes", "Keywords"],
  55: ["dates", "Date created (IPTC)"],
  80: ["author", "Photographer"],
  85: ["author", "Photographer's title"],
  90: ["location", "City"],
  92: ["location", "Location detail"],
  95: ["location", "State or region"],
  101: ["location", "Country"],
  105: ["notes", "Headline"],
  110: ["author", "Credit"],
  115: ["author", "Source"],
  116: ["author", "Copyright notice"],
  120: ["notes", "Caption"],
  122: ["author", "Caption writer"],
}

function decode(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim()
  } catch {
    return new TextDecoder("latin1").decode(bytes).trim() // older IPTC is not UTF-8
  }
}

/** Find the IPTC records inside the Photoshop resource blocks. */
function findIptc(irb: Uint8Array): Uint8Array | null {
  const view = new DataView(irb.buffer, irb.byteOffset, irb.byteLength)
  let i = 0
  while (i + 12 <= irb.length) {
    if (irb[i] !== 0x38 || irb[i + 1] !== 0x42 || irb[i + 2] !== 0x49 || irb[i + 3] !== 0x4d) return null // not "8BIM"
    const id = view.getUint16(i + 4)
    const nameLen = irb[i + 6]
    const sizeAt = i + 6 + (1 + nameLen + ((1 + nameLen) % 2)) // pascal name, padded to an even length
    if (sizeAt + 4 > irb.length) return null
    const size = view.getUint32(sizeAt)
    const dataAt = sizeAt + 4
    if (dataAt + size > irb.length) return null
    if (id === 0x0404) return irb.subarray(dataAt, dataAt + size)
    i = dataAt + size + (size % 2)
  }
  return null
}

export function parseIptc(irb: Uint8Array): ReportField[] {
  const data = findIptc(irb)
  if (!data) return []

  const values = new Map<number, string[]>()
  let i = 0
  while (i + 5 <= data.length) {
    if (data[i] !== 0x1c) break
    const record = data[i + 1]
    const dataset = data[i + 2]
    const length = (data[i + 3] << 8) | data[i + 4]
    if (length & 0x8000) return [] // "extended" lengths are not used by anything we read; stop rather than guess
    if (i + 5 + length > data.length) return []
    if (record === 2 && DATASETS[dataset]) {
      const text = decode(data.subarray(i + 5, i + 5 + length))
      if (text) values.set(dataset, [...(values.get(dataset) ?? []), text])
    }
    i += 5 + length
  }

  const out: ReportField[] = []
  for (const [dataset, list] of values) {
    const [group, label] = DATASETS[dataset]
    const joined = list.join(", ")
    // IPTC dates are written 20260102
    const value = dataset === 55 && /^\d{8}$/.test(joined) ? `${joined.slice(0, 4)}-${joined.slice(4, 6)}-${joined.slice(6, 8)}` : joined
    out.push({ group, label, value, source: "IPTC" })
  }
  return out
}
