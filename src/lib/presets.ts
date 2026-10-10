import { coerceForm, type TagForm } from "./tag-form"

/**
 * Presets: a name plus the six Tag fields, kept in this browser's localStorage and nowhere else
 * (docs/tags.md). Storage can be blocked, full, or hold data an older version wrote, so every read
 * and write is guarded and the Tag form works without any of it.
 */

export interface Preset {
  id: string
  name: string
  tags: TagForm
}

const KEY = "black-lens:presets"
export const MAX_PRESETS = 20
const NAME_MAX = 60

/** Read the saved presets. `available` is false when storage cannot be used at all (private window, blocked). */
export function loadPresets(): { available: boolean; presets: Preset[] } {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return { available: false, presets: [] }
  }
  if (!raw) return { available: true, presets: [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { available: true, presets: [] } // damaged: start fresh rather than fail
  }
  if (!Array.isArray(parsed)) return { available: true, presets: [] }

  const presets: Preset[] = []
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue
    const { id, name, tags } = item as Record<string, unknown>
    const form = coerceForm(tags)
    if (typeof name !== "string" || !name.trim() || !form) continue
    presets.push({ id: typeof id === "string" && id ? id : newId(), name: name.trim().slice(0, NAME_MAX), tags: form })
    if (presets.length === MAX_PRESETS) break
  }
  return { available: true, presets }
}

/** Save the list. Returns false if the browser refused (storage full or blocked). */
export function storePresets(presets: Preset[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(presets))
    return true
  } catch {
    return false
  }
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** Add a preset, or replace the one with the same name (ignoring case). Keeps the newest if the list is full. */
export function addPreset(list: Preset[], name: string, tags: TagForm): Preset[] {
  const clean = name.trim().slice(0, NAME_MAX)
  const existing = list.find((p) => p.name.toLowerCase() === clean.toLowerCase())
  if (existing) return list.map((p) => (p === existing ? { ...p, name: clean, tags } : p))
  return [...list, { id: newId(), name: clean, tags }].slice(-MAX_PRESETS)
}
