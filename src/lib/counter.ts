import { and, asc, gte, lte, sql } from "drizzle-orm"
import type { PgDatabase } from "drizzle-orm/pg-core"
import { COUNT_MODES, dailyCounts, type CountMode } from "@/db/schema"
import { DAILY_CAP, lastDays } from "./count-rules"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = PgDatabase<any, any, any>

/**
 * Adds `n` photos to the day's total for one mode, in a single statement so that simultaneous calls
 * cannot lose each other's counts. Returns false, changing nothing, when it would pass the daily cap.
 */
export async function recordCount(db: Db, { mode, n, day }: { mode: CountMode; n: number; day: string }): Promise<boolean> {
  const rows = await db
    .insert(dailyCounts)
    .values({ day, mode, count: n })
    .onConflictDoUpdate({
      target: [dailyCounts.day, dailyCounts.mode],
      set: { count: sql`${dailyCounts.count} + ${n}` },
      setWhere: sql`${dailyCounts.count} + ${n} <= ${DAILY_CAP}`,
    })
    .returning({ count: dailyCounts.count })
  return rows.length > 0
}

export type DayCounts = { day: string } & Record<CountMode, number>

/** One entry per day for the last `days` days ending at `today`, oldest first, with zeros where nothing was counted. */
export async function readDailyCounts(db: Db, { today, days }: { today: string; days: number }): Promise<DayCounts[]> {
  const window = lastDays(today, days)
  const rows = await db
    .select()
    .from(dailyCounts)
    .where(and(gte(dailyCounts.day, window[0]), lte(dailyCounts.day, today)))
    .orderBy(asc(dailyCounts.day))
  const byDay = new Map<string, DayCounts>(window.map((day) => [day, { day, ...Object.fromEntries(COUNT_MODES.map((m) => [m, 0])) } as DayCounts]))
  for (const r of rows) {
    const entry = byDay.get(r.day)
    if (entry && (COUNT_MODES as readonly string[]).includes(r.mode)) entry[r.mode as CountMode] = r.count
  }
  return window.map((d) => byDay.get(d)!)
}
