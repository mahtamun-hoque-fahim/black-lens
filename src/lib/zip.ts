import { crc32 } from "./crc32"

/**
 * ZIP reading and writing, with no dependencies. The format is documented in
 * docs/formats/zip.md; read that first. All integers are little-endian.
 */

export type ZipErrorCode = "corrupt" | "unsupported" | "too-large" | "too-many"

export class ZipError extends Error {
  readonly code: ZipErrorCode

  constructor(code: ZipErrorCode, message: string) {
    super(message)
    this.name = "ZipError"
    this.code = code
  }
}

export interface ZipEntry {
  name: string
  bytes: Uint8Array
}

/** An entry read from an archive. `path` is as stored; `name` is the safe last segment. */
export interface ReadEntry extends ZipEntry {
  path: string
}

export interface ZipLimits {
  maxEntries: number
  maxFileBytes: number
  maxTotalBytes: number
}

const SIG_LOCAL = 0x04034b50
const SIG_CENTRAL = 0x02014b50
const SIG_EOCD = 0x06054b50
const FLAG_ENCRYPTED = 0x0001
const FLAG_UTF8 = 0x0800
const METHOD_STORE = 0
const METHOD_DEFLATE = 8

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Only the last path segment, splitting on both / and \. "../../x.jpg" can only ever mean "x.jpg". */
export function safeBaseName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1]
}

/** macOS and Windows leftovers that are never photos. */
export function isJunkName(path: string): boolean {
  if (path.split(/[\\/]/).includes("__MACOSX")) return true
  const base = safeBaseName(path)
  const lower = base.toLowerCase()
  return base.startsWith("._") || base === ".DS_Store" || lower === "thumbs.db" || lower === "desktop.ini"
}

/** Make a list of names unique by numbering repeats before the extension: a.jpg, a (2).jpg, a (3).jpg */
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>()
  const seen = new Map<string, number>()
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1
    seen.set(name, count)
    let candidate = name
    if (count > 1 || used.has(candidate)) {
      const dot = name.lastIndexOf(".")
      const stem = dot > 0 ? name.slice(0, dot) : name
      const ext = dot > 0 ? name.slice(dot) : ""
      let n = Math.max(count, 2)
      candidate = `${stem} (${n})${ext}`
      while (used.has(candidate)) candidate = `${stem} (${++n})${ext}`
    }
    used.add(candidate)
    return candidate
  })
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const corrupt = (message: string) => new ZipError("corrupt", message)

/**
 * Inflate a raw deflate stream with the browser's built-in decompressor. The output buffer is
 * sized from the declared size, which the caller has already checked against the limits, and the
 * loop stops the instant the data passes it. A zip bomb therefore never gets to allocate anything
 * beyond what its (limit-checked) header claimed.
 */
async function inflate(data: Uint8Array, expected: number): Promise<Uint8Array> {
  // A plain ReadableStream works in every browser; Blob.stream() is missing from some older ones.
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(data as BufferSource)
      controller.close()
    },
  })
  const stream = source.pipeThrough(new DecompressionStream("deflate-raw"))
  const reader = stream.getReader()
  const out = new Uint8Array(expected)
  let written = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (written + value.length > expected) throw corrupt("A file in the ZIP is bigger than the ZIP says it is.")
      out.set(value, written)
      written += value.length
    }
  } catch (e) {
    await reader.cancel().catch(() => {})
    if (e instanceof ZipError) throw e
    throw corrupt("A file in the ZIP could not be unpacked.") // the decompressor rejected the data itself
  }
  if (written !== expected) throw corrupt("A file in the ZIP is smaller than the ZIP says it is.")
  return out
}

interface CentralEntry {
  path: string
  flags: number
  method: number
  crc: number
  compSize: number
  size: number
  localOffset: number
}

/**
 * Read every file in a ZIP. Directories and macOS/Windows junk are skipped. Throws ZipError for
 * anything it cannot read safely: corrupt, encrypted, ZIP64, over the limits.
 */
export async function readZip(bytes: Uint8Array, limits: ZipLimits): Promise<ReadEntry[]> {
  const len = bytes.length
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // 1. Find the end-of-central-directory record: the last 22 bytes, unless a comment follows (up to 65535 bytes).
  let eocd = -1
  for (let i = len - 22; i >= Math.max(0, len - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw corrupt("This does not look like a ZIP file, or it is damaged.")

  const total = view.getUint16(eocd + 10, true)
  const cdSize = view.getUint32(eocd + 12, true)
  const cdOffset = view.getUint32(eocd + 16, true)
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new ZipError("unsupported", "This ZIP uses a format for very large archives that Black Lens does not read.")
  }
  if (cdOffset + cdSize > eocd) throw corrupt("The ZIP is damaged: its file list points outside the file.")

  // 2. Read the central directory. It has the real sizes and CRCs, even when the local headers use a data descriptor.
  const central: CentralEntry[] = []
  const decoders = { utf8: new TextDecoder("utf-8"), legacy: new TextDecoder("windows-1252") }
  let pos = cdOffset
  for (let n = 0; n < total; n++) {
    if (pos + 46 > cdOffset + cdSize || view.getUint32(pos, true) !== SIG_CENTRAL) throw corrupt("The ZIP's file list is damaged.")
    const flags = view.getUint16(pos + 8, true)
    const nameLen = view.getUint16(pos + 28, true)
    const extraLen = view.getUint16(pos + 30, true)
    const commentLen = view.getUint16(pos + 32, true)
    if (pos + 46 + nameLen + extraLen + commentLen > cdOffset + cdSize) throw corrupt("The ZIP's file list is damaged.")
    const nameBytes = bytes.subarray(pos + 46, pos + 46 + nameLen)
    central.push({
      path: (flags & FLAG_UTF8 ? decoders.utf8 : decoders.legacy).decode(nameBytes),
      flags,
      method: view.getUint16(pos + 10, true),
      crc: view.getUint32(pos + 16, true),
      compSize: view.getUint32(pos + 20, true),
      size: view.getUint32(pos + 24, true),
      localOffset: view.getUint32(pos + 42, true),
    })
    pos += 46 + nameLen + extraLen + commentLen
  }

  // 3. Decide which entries we will actually unpack, and check every limit from the headers alone.
  const wanted = central.filter((e) => !/[\\/]$/.test(e.path) && !isJunkName(e.path))
  if (wanted.length > limits.maxEntries) throw new ZipError("too-many", "This ZIP holds more files than Black Lens can take in one go.")

  let declaredTotal = 0
  for (const e of wanted) {
    if (e.flags & FLAG_ENCRYPTED) throw new ZipError("unsupported", "This ZIP is password protected, which Black Lens cannot open.")
    if (e.method !== METHOD_STORE && e.method !== METHOD_DEFLATE) {
      throw new ZipError("unsupported", "This ZIP uses a compression method that Black Lens does not read.")
    }
    if (e.compSize === 0xffffffff || e.size === 0xffffffff || e.localOffset === 0xffffffff) {
      throw new ZipError("unsupported", "This ZIP uses a format for very large archives that Black Lens does not read.")
    }
    if (e.size > limits.maxFileBytes) throw new ZipError("too-large", "A file in this ZIP is too big.")
    declaredTotal += e.size
    if (declaredTotal > limits.maxTotalBytes) throw new ZipError("too-large", "The files in this ZIP add up to more than Black Lens can take in one go.")
  }

  // 4. Unpack, one at a time.
  const out: ReadEntry[] = []
  for (const e of wanted) {
    const at = e.localOffset
    if (at + 30 > cdOffset || view.getUint32(at, true) !== SIG_LOCAL) throw corrupt("The ZIP is damaged: a file's header is missing.")
    const dataStart = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
    const dataEnd = dataStart + e.compSize
    if (dataEnd > cdOffset) throw corrupt("The ZIP is damaged: a file's data runs past the end.")
    const raw = bytes.subarray(dataStart, dataEnd)

    let data: Uint8Array
    if (e.method === METHOD_STORE) {
      if (e.compSize !== e.size) throw corrupt("The ZIP is damaged: a stored file has the wrong size.")
      data = raw.slice()
    } else {
      data = await inflate(raw, e.size)
    }
    if (crc32(data) !== e.crc) throw corrupt("The ZIP is damaged: a file does not match its checksum.")
    out.push({ path: e.path, name: safeBaseName(e.path), bytes: data })
  }
  return out
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const DOS_TIME = 0x0000 // 00:00:00
const DOS_DATE = 0x0021 // 1980-01-01: year 0 (=1980) << 9 | month 1 << 5 | day 1. The earliest a ZIP can say.

/**
 * Build a ZIP as a list of byte chunks, so a large batch is never copied into one giant buffer.
 * Files are stored, not deflated: photos are already compressed. The timestamp is fixed, so the
 * archive does not record when the person cleaned their photos. See docs/formats/zip.md.
 */
export function writeZip(entries: ZipEntry[]): Uint8Array[] {
  if (entries.length > 0xffff) throw new ZipError("too-many", "A ZIP can hold at most 65,535 files.")

  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    if (name.length === 0 || name.length > 0xffff) throw new ZipError("unsupported", "A file name could not be stored in the ZIP.")
    if (entry.bytes.length > 0xffffffff) throw new ZipError("too-large", "A file is too big for a ZIP.")
    const crc = crc32(entry.bytes)

    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, SIG_LOCAL, true)
    lv.setUint16(4, 20, true) // version needed to extract: 2.0
    lv.setUint16(6, FLAG_UTF8, true) // names are UTF-8; no encryption, no data descriptor
    lv.setUint16(8, METHOD_STORE, true)
    lv.setUint16(10, DOS_TIME, true)
    lv.setUint16(12, DOS_DATE, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, entry.bytes.length, true) // compressed size = size, because stored
    lv.setUint32(22, entry.bytes.length, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true) // no extra field
    local.set(name, 30)

    const header = new Uint8Array(46 + name.length)
    const cv = new DataView(header.buffer)
    cv.setUint32(0, SIG_CENTRAL, true)
    cv.setUint16(4, 20, true) // made by: MS-DOS, 2.0. No Unix owner or permission bits are recorded.
    cv.setUint16(6, 20, true)
    cv.setUint16(8, FLAG_UTF8, true)
    cv.setUint16(10, METHOD_STORE, true)
    cv.setUint16(12, DOS_TIME, true)
    cv.setUint16(14, DOS_DATE, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, entry.bytes.length, true)
    cv.setUint32(24, entry.bytes.length, true)
    cv.setUint16(28, name.length, true)
    // extra length, comment length, disk number, internal and external attributes: all zero
    cv.setUint32(42, offset, true) // where this file's local header starts
    header.set(name, 46)

    parts.push(local, entry.bytes)
    central.push(header)
    offset += local.length + entry.bytes.length
    if (offset > 0xffffffff) throw new ZipError("too-large", "This archive would be too big for a ZIP.")
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, SIG_EOCD, true)
  ev.setUint16(8, entries.length, true) // entries on this disk
  ev.setUint16(10, entries.length, true) // entries in total
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true) // where the central directory starts
  // comment length: zero

  return [...parts, ...central, eocd]
}

/** Join chunks into one array. Only for tests and small archives; downloads hand the chunks to a Blob. */
export function zipToBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
