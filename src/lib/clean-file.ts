import { MetadataError, type KeptItem, type MetadataSummary, type RemovedItem } from "@/lib/metadata"
import { uniqueNames, type ZipEntry } from "@/lib/zip"

/** photo.jpg becomes photo-clean.jpg. The original is never overwritten. */
export function cleanFileName(name: string, fallbackExtension = ".jpg"): string {
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return `${name || "photo"}-clean${fallbackExtension}`
  return `${name.slice(0, dot)}-clean${name.slice(dot)}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** What the photo carries, as short plain phrases. Empty when nothing is found. */
export function foundItems(s: MetadataSummary): string[] {
  const items: string[] = []
  if (s.location) items.push("Where the photo was taken")
  if (s.camera) items.push("Camera make, model or serial numbers")
  if (s.dates) items.push("Date and time it was taken")
  if (s.software) items.push("Editing software")
  if (s.author) items.push("Author and copyright details")
  if (s.notes) items.push("Captions, keywords and notes")
  if (s.preview) items.push("A small preview copy of the picture")
  if (s.extraData) items.push("Extra data attached after the image")
  if (s.other) items.push("Other embedded data")
  return items
}

export function removedLabel(kind: RemovedItem["kind"]): string {
  switch (kind) {
    case "exif":
      return "Camera, date, location and software details"
    case "xmp":
      return "Editing and author notes"
    case "iptc":
      return "Captions, keywords and credits"
    case "comment":
      return "Text comments"
    case "text":
      return "Text notes, author and software details"
    case "modified-time":
      return "The time the file was last changed"
    case "jfif-thumbnail":
      return "A small preview copy of the picture"
    case "trailing-data":
      return "Extra data attached after the image"
    case "icc":
      return "Colour profile"
    case "other-segment":
      return "Other embedded data"
  }
}

export function keptLabel(item: KeptItem): string {
  switch (item.kind) {
    case "orientation":
      return "Rotation, so the photo still shows the right way up"
    case "icc":
      return "Colour profile, so colours look the same"
    case "structure":
      return "The data the format needs to show the image"
  }
}

const GENERIC = "Something went wrong while reading this file. Nothing was changed."

/** One plain sentence for the person, never an internal message. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof MetadataError)) return GENERIC
  switch (error.code) {
    case "corrupt":
      return "This file looks damaged, so it could not be read. Nothing was changed."
    case "unknown-format":
      return "This does not look like a JPEG, PNG or WebP photo."
    case "verification-failed":
      return "The cleaned photo could not be checked, so it was not saved. Your original is untouched."
    case "unsupported":
      return error.message
  }
}

/** The word-only chip a failed photo gets in the queue (DESIGN_GUIDE.md: "Not supported" and friends). */
export function chipForError(error: unknown): string {
  if (error instanceof MetadataError) {
    if (error.code === "unsupported" || error.code === "unknown-format") return "Not supported"
    if (error.code === "corrupt") return "Damaged"
  }
  return "Problem"
}

/** Plain sentences about what happened while the files were gathered. Empty when nothing needs saying. */
export function noticesFor(info: { skipped: number; truncated: boolean; zipErrors: string[]; planNotice: string | null }): string[] {
  const notices = [...info.zipErrors]
  if (info.skipped === 1) notices.push("1 file was not a photo and was left out.")
  else if (info.skipped > 1) notices.push(`${info.skipped} files were not photos and were left out.`)
  if (info.truncated) notices.push("That folder is very large, so only the first photos were read.")
  if (info.planNotice) notices.push(info.planNotice)
  return notices
}

/** Entries for the output ZIP. Two photos called a.jpg must not overwrite each other. */
export function batchZipEntries(done: { outName: string; bytes: Uint8Array }[]): ZipEntry[] {
  const names = uniqueNames(done.map((d) => d.outName))
  return done.map((d, i) => ({ name: names[i], bytes: d.bytes }))
}
