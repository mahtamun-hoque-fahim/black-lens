import { MetadataError, type KeptItem, type MetadataSummary, type RemovedItem } from "@/lib/metadata"

/** photo.jpg becomes photo-clean.jpg. The original is never overwritten. */
export function cleanFileName(name: string): string {
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return `${name || "photo"}-clean.jpg`
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
