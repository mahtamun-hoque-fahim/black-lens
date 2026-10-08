import type { MetadataSummary, StripMetadataResult } from "@/lib/metadata"

export type ItemStatus = "reading" | "ready" | "cleaning" | "done" | "error"

/** One photo in the queue. `file` is only read when needed; the browser holds the bytes, not us. */
export interface Item {
  id: number
  file: File
  name: string
  size: number
  status: ItemStatus
  summary?: MetadataSummary
  result?: StripMetadataResult
  outName?: string
  error?: string
  /** Word-only chip for a failed photo, e.g. "Not supported". */
  chip?: string
}

export interface Chip {
  text: string
  /** "location" uses the destructive tokens; everything else is neutral. */
  tone: "location" | "neutral"
}

export function chipForSummary(summary: MetadataSummary): Chip {
  if (summary.location) return { text: "Has location", tone: "location" }
  if (summary.alreadyClean) return { text: "Already clean", tone: "neutral" }
  return { text: "Has metadata", tone: "neutral" }
}

export function chipForItem(item: Item): Chip {
  switch (item.status) {
    case "reading":
      return { text: "Reading", tone: "neutral" }
    case "cleaning":
      return { text: "Cleaning", tone: "neutral" }
    case "done":
      return { text: "Cleaned", tone: "neutral" }
    case "error":
      return { text: item.chip ?? "Problem", tone: "neutral" }
    case "ready":
      return item.summary ? chipForSummary(item.summary) : { text: "Reading", tone: "neutral" }
  }
}
