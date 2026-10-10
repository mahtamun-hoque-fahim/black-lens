/**
 * The six fields Tag mode writes, and the one place that decides what typed text is acceptable.
 * Everything downstream (the XMP, EXIF and PNG writers) receives only `Tags` that came out of
 * `normalizeTags`, so none of them has to worry about control characters, over-long text or a
 * date that does not exist. Rules: docs/tags.md.
 */

export interface Tags {
  artist: string
  copyright: string
  title: string
  description: string
  keywords: string[]
  /** YYYY-MM-DD, or "" when not set. */
  date: string
}

export const EMPTY_TAGS: Tags = { artist: "", copyright: "", title: "", description: "", keywords: [], date: "" }

export type TagField = "artist" | "copyright" | "title" | "description" | "keywords" | "date"

export interface TagError {
  field: TagField
  message: string
}

export interface TagInput {
  artist?: string
  copyright?: string
  title?: string
  description?: string
  /** Typed as one string separated by commas, or already a list. */
  keywords?: string | string[]
  date?: string
}

export const TAG_LIMITS = { artist: 200, copyright: 500, title: 200, description: 2000, keywords: 50, keyword: 100 } as const

const LABELS: Record<"artist" | "copyright" | "title" | "description", string> = {
  artist: "Artist",
  copyright: "Copyright",
  title: "Title",
  description: "Description",
}

/** Characters people see, not UTF-16 code units: one emoji counts as one. */
const length = (s: string) => [...s].length

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g
// C0 and C1 controls except tab, line feed and carriage return (handled separately), plus the
// bidirectional overrides and isolates that can make one name display as another, and the byte order mark.
// Zero-width joiners (U+200C, U+200D) are kept on purpose: Bengali and other scripts need them.
const UNWANTED = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFEFF]/g

function base(text: string): string {
  return text.replace(LONE_SURROGATE, "\uFFFD").normalize("NFC")
}

/** One-line text: every kind of line break and tab becomes a space, then runs of spaces collapse. */
function oneLine(text: string): string {
  return base(text)
    .replace(/[\r\n\t\u2028\u2029]+/g, " ")
    .replace(UNWANTED, "")
    .replace(/ {2,}/g, " ")
    .trim()
}

/** Multi-line text: line breaks become plain \n, with at most one blank line in a row. */
function manyLines(text: string): string {
  return base(text)
    .replace(/\r\n|\r|\u2028|\u2029/g, "\n")
    .replace(/\t/g, " ")
    .replace(UNWANTED, "")
    .replace(/[ ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function isRealDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 1900 || y > 2100) return false
  const check = new Date(Date.UTC(y, mo - 1, d))
  return check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d
}

export function normalizeTags(input: TagInput): { tags: Tags; errors: TagError[] } {
  const errors: TagError[] = []
  const tags: Tags = { ...EMPTY_TAGS, keywords: [] }

  for (const field of ["artist", "copyright", "title"] as const) {
    const value = oneLine(input[field] ?? "")
    if (length(value) > TAG_LIMITS[field]) errors.push({ field, message: `${LABELS[field]} is longer than ${TAG_LIMITS[field]} characters.` })
    else tags[field] = value
  }

  const description = manyLines(input.description ?? "")
  if (length(description) > TAG_LIMITS.description) errors.push({ field: "description", message: `Description is longer than ${TAG_LIMITS.description} characters.` })
  else tags.description = description

  const rawKeywords = Array.isArray(input.keywords) ? input.keywords : (input.keywords ?? "").split(/[,\n\r]/)
  const seen = new Set<string>()
  const keywords: string[] = []
  for (const raw of rawKeywords) {
    const word = oneLine(raw)
    if (!word || seen.has(word.toLowerCase())) continue
    seen.add(word.toLowerCase())
    keywords.push(word)
  }
  if (keywords.length > TAG_LIMITS.keywords) errors.push({ field: "keywords", message: `Keywords: use ${TAG_LIMITS.keywords} or fewer.` })
  else if (keywords.some((k) => length(k) > TAG_LIMITS.keyword)) errors.push({ field: "keywords", message: `Each keyword can be at most ${TAG_LIMITS.keyword} characters.` })
  else tags.keywords = keywords

  const date = (input.date ?? "").trim()
  if (date) {
    if (isRealDate(date)) tags.date = date
    else errors.push({ field: "date", message: "Date must be a real date, like 2026-01-02." })
  }

  return { tags, errors }
}

export function isEmptyTags(tags: Tags): boolean {
  return !tags.artist && !tags.copyright && !tags.title && !tags.description && tags.keywords.length === 0 && !tags.date
}

/** What will be written, as plain label and value pairs, in a fixed order. Empty fields are left out. */
export function tagLines(tags: Tags): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = []
  if (tags.artist) lines.push({ label: "Artist", value: tags.artist })
  if (tags.copyright) lines.push({ label: "Copyright", value: tags.copyright })
  if (tags.title) lines.push({ label: "Title", value: tags.title })
  if (tags.description) lines.push({ label: "Description", value: tags.description })
  if (tags.keywords.length) lines.push({ label: "Keywords", value: tags.keywords.join(", ") })
  if (tags.date) lines.push({ label: "Date", value: tags.date })
  return lines
}
