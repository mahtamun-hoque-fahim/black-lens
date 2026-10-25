import { COUNT_MODES, type CountMode } from "@/db/schema"
import { LIMITS } from "./limits"

/** One call can report at most one whole batch. */
export const MAX_PER_CALL = LIMITS.maxFiles
/**
 * Most photos one mode can add up to in one UTC day. The counter is open to anyone who can reach the
 * site, so this is what stops one script from filling the chart with a huge number.
 */
export const DAILY_CAP = 20_000

export type ParsedCount = { ok: true; mode: CountMode; n: number } | { ok: false }

/** Accepts exactly `{ mode, n }` and nothing else. */
export function parseCountBody(body: unknown): ParsedCount {
  const bad: ParsedCount = { ok: false }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return bad
  const keys = Object.keys(body)
  if (keys.length !== 2 || !keys.includes("mode") || !keys.includes("n")) return bad
  const { mode, n } = body as Record<string, unknown>
  if (typeof mode !== "string" || !(COUNT_MODES as readonly string[]).includes(mode)) return bad
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_PER_CALL) return bad
  return { ok: true, mode: mode as CountMode, n }
}

/** The calendar date in UTC, as YYYY-MM-DD. One global day boundary; no timezone is ever stored. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The last `days` dates ending at `today`, oldest first. */
export function lastDays(today: string, days: number): string[] {
  const end = Date.parse(`${today}T00:00:00Z`)
  return Array.from({ length: days }, (_, i) => utcDay(new Date(end - (days - 1 - i) * 86_400_000)))
}
