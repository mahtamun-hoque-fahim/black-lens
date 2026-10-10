import type { TagInput } from "@/lib/metadata"

/** The Tag form as typed: every field is plain text, keywords as one comma-separated string. */
export interface TagForm {
  artist: string
  copyright: string
  title: string
  description: string
  keywords: string
  date: string
}

export const EMPTY_FORM: TagForm = { artist: "", copyright: "", title: "", description: "", keywords: "", date: "" }

export const formToInput = (form: TagForm): TagInput => ({ ...form })

export const isBlankForm = (form: TagForm): boolean => Object.values(form).every((v) => v.trim() === "")

/** Turn anything read back from storage into a form, or null if it is not an object. Wrong-typed fields become empty. */
export function coerceForm(value: unknown): TagForm | null {
  if (typeof value !== "object" || value === null) return null
  const v = value as Record<string, unknown>
  const text = (x: unknown) => (typeof x === "string" ? x : "")
  return { artist: text(v.artist), copyright: text(v.copyright), title: text(v.title), description: text(v.description), keywords: text(v.keywords), date: text(v.date) }
}
