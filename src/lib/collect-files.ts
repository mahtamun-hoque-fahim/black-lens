import { LIMITS } from "./limits"
import { readZip, ZipError } from "./zip"

export interface BatchLimits {
  readonly maxFiles: number
  readonly maxFileBytes: number
  readonly maxTotalBytes: number
}

const PHOTO = /^.+\.(jpe?g|png|webp|heic|heif)$/i
const ZIP = /\.zip$/i

export const isPhotoName = (name: string) => PHOTO.test(name)
export const isZipName = (name: string) => ZIP.test(name)

/** Worth looking at when it came out of a folder or a ZIP: a photo or a ZIP, and not a hidden file. */
const isCandidate = (name: string) => !name.startsWith(".") && (isPhotoName(name) || isZipName(name))

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024))

export interface Collected {
  files: File[]
  /** Files that were not photos (notes.txt, .DS_Store, ...) and were left out. */
  skipped: number
  /** A folder was so big that reading stopped early. */
  truncated: boolean
}

/** For a folder chosen with the folder picker: keep photos and ZIPs, count the rest. */
export function filterCandidates(files: File[]): { files: File[]; skipped: number } {
  const kept = files.filter((f) => isCandidate(f.name))
  return { files: kept, skipped: files.length - kept.length }
}

// ---------------------------------------------------------------------------
// Dropped folders
// ---------------------------------------------------------------------------

// The slice of the browser's FileSystemEntry API that we use.
interface FsReader {
  readEntries(ok: (entries: FsEntry[]) => void, fail: (e: unknown) => void): void
}
interface FsEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?(ok: (file: File) => void, fail: (e: unknown) => void): void
  createReader?(): FsReader
}

const readBatch = (reader: FsReader) => new Promise<FsEntry[]>((ok, fail) => reader.readEntries(ok, fail))
const getFile = (entry: FsEntry) => new Promise<File>((ok, fail) => entry.file!(ok, fail))

/**
 * Everything that was dropped, with folders walked recursively. A folder is read in batches: the
 * browser hands back a few entries at a time and an empty batch means "that was all".
 */
export async function collectFromDataTransfer(dt: DataTransfer): Promise<Collected> {
  // The dropped items are only valid until the first await, so take them all out right now.
  const entries: FsEntry[] = []
  const plain: File[] = []
  const items = dt.items ? Array.from(dt.items) : []
  for (const item of items) {
    if (item.kind !== "file") continue
    const entry = (item as { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry?.()
    if (entry) entries.push(entry)
    else {
      const file = item.getAsFile()
      if (file) plain.push(file)
    }
  }
  if (items.length === 0 && dt.files) plain.push(...Array.from(dt.files))

  const cap = LIMITS.maxFiles + 1 // one more than we will take, so the caller can tell the batch was too big
  const files: File[] = [...plain]
  let skipped = 0
  let truncated = false

  async function walk(entry: FsEntry, topLevel: boolean): Promise<void> {
    if (truncated) return
    if (entry.isFile) {
      const file = await getFile(entry)
      // A file the person dropped by hand is kept even if it is not a photo, so they get an honest error.
      if (!topLevel && !isCandidate(file.name)) {
        skipped++
        return
      }
      if (files.length >= cap) truncated = true
      else files.push(file)
      return
    }
    if (entry.isDirectory && entry.createReader) {
      const reader = entry.createReader()
      for (;;) {
        const batch = await readBatch(reader)
        if (batch.length === 0) break
        for (const child of batch) {
          await walk(child, false)
          if (truncated) return
        }
      }
    }
  }

  for (const entry of entries) await walk(entry, entry.isFile)
  return { files, skipped, truncated }
}

// ---------------------------------------------------------------------------
// ZIP input
// ---------------------------------------------------------------------------

export interface Expanded {
  files: File[]
  skipped: number
  errors: string[]
}

/** ZIPs start with "PK" and a version marker; empty ZIPs start with the end-of-directory marker instead. */
async function looksLikeZip(file: File): Promise<boolean> {
  if (isZipName(file.name)) return true
  if (file.size < 4) return false
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  return head[0] === 0x50 && head[1] === 0x4b && (head[2] === 3 || head[2] === 5) && (head[3] === 4 || head[3] === 6)
}

/** Replace every ZIP in the list with the photos inside it. Broken ZIPs become plain-language errors. */
export async function expandZips(files: File[], limits: BatchLimits = LIMITS): Promise<Expanded> {
  const out: File[] = []
  const errors: string[] = []
  let skipped = 0

  for (const file of files) {
    if (!(await looksLikeZip(file))) {
      out.push(file)
      continue
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const entries = await readZip(bytes, {
        maxEntries: limits.maxFiles,
        maxFileBytes: limits.maxFileBytes,
        maxTotalBytes: limits.maxTotalBytes,
      })
      for (const entry of entries) {
        if (isPhotoName(entry.name)) out.push(new File([entry.bytes as BlobPart], entry.name))
        else skipped++
      }
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof ZipError ? e.message : "This ZIP could not be opened."}`)
    }
  }
  return { files: out, skipped, errors }
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export interface PlannedItem<F> {
  file: F
  /** Set when this photo cannot be processed (too big). It is still shown, so the person knows. */
  error?: string
}

/**
 * Apply the batch limits. A photo over the size limit stays in the list as an error and does not
 * use up the budget. Photos past the count or total-size limit are left out, with one plain notice.
 */
export function planBatch<F extends { name: string; size: number }>(
  files: F[],
  limits: BatchLimits = LIMITS,
): { items: PlannedItem<F>[]; notice: string | null } {
  const items: PlannedItem<F>[] = []
  let budget = 0
  let leftOut = 0
  let reason: "count" | "size" | null = null

  for (const file of files) {
    if (items.length >= limits.maxFiles) {
      leftOut++
      reason ??= "count"
    } else if (file.size > limits.maxFileBytes) {
      items.push({ file, error: `This photo is bigger than ${mb(limits.maxFileBytes)} MB.` })
    } else if (budget + file.size > limits.maxTotalBytes) {
      leftOut++
      reason ??= "size"
    } else {
      budget += file.size
      items.push({ file })
    }
  }

  let notice: string | null = null
  if (leftOut > 0) {
    notice =
      reason === "count"
        ? `Only the first ${limits.maxFiles} photos were added. ${leftOut} more were left out.`
        : `Only the first ${items.length} photos were added, because a batch can hold up to ${mb(limits.maxTotalBytes)} MB in total. ${leftOut} more were left out.`
  }
  return { items, notice }
}
