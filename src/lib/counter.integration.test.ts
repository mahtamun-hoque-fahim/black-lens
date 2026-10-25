// @vitest-environment node
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import * as schema from "@/db/schema"
import { DAILY_CAP } from "./count-rules"
import { readDailyCounts, recordCount } from "./counter"

let client: PGlite
let db: ReturnType<typeof drizzle<typeof schema>>

beforeAll(async () => {
  client = new PGlite()
  await client.exec(readFileSync("db/schema.sql", "utf8"))
  db = drizzle(client, { schema })
})
beforeEach(async () => {
  await client.exec("delete from daily_counts")
})
afterAll(() => client.close())

const total = async (day: string, mode: string) => {
  const r = await client.query<{ count: number }>("select count from daily_counts where day = $1 and mode = $2", [day, mode])
  return r.rows[0]?.count ?? null
}

describe("recordCount", () => {
  it("creates the day's row on first use", async () => {
    expect(await recordCount(db, { mode: "clean", n: 3, day: "2026-10-25" })).toBe(true)
    expect(await total("2026-10-25", "clean")).toBe(3)
  })

  it("adds to the same day and mode", async () => {
    await recordCount(db, { mode: "tag", n: 2, day: "2026-10-25" })
    await recordCount(db, { mode: "tag", n: 5, day: "2026-10-25" })
    expect(await total("2026-10-25", "tag")).toBe(7)
  })

  it("keeps modes and days apart", async () => {
    await recordCount(db, { mode: "view", n: 1, day: "2026-10-25" })
    await recordCount(db, { mode: "clean", n: 4, day: "2026-10-25" })
    await recordCount(db, { mode: "clean", n: 9, day: "2026-10-26" })
    expect(await total("2026-10-25", "view")).toBe(1)
    expect(await total("2026-10-25", "clean")).toBe(4)
    expect(await total("2026-10-26", "clean")).toBe(9)
  })

  it("loses no counts when many arrive at once", async () => {
    await Promise.all(Array.from({ length: 25 }, () => recordCount(db, { mode: "clean", n: 2, day: "2026-10-25" })))
    expect(await total("2026-10-25", "clean")).toBe(50)
  })

  it("refuses to pass the daily cap and leaves the total unchanged", async () => {
    await client.query("insert into daily_counts (day, mode, count) values ('2026-10-25', 'clean', $1)", [DAILY_CAP - 5])
    expect(await recordCount(db, { mode: "clean", n: 5, day: "2026-10-25" })).toBe(true)
    expect(await total("2026-10-25", "clean")).toBe(DAILY_CAP)
    expect(await recordCount(db, { mode: "clean", n: 1, day: "2026-10-25" })).toBe(false)
    expect(await total("2026-10-25", "clean")).toBe(DAILY_CAP)
  })

  it("applies the cap per mode, so one full mode does not block another", async () => {
    await client.query("insert into daily_counts (day, mode, count) values ('2026-10-25', 'clean', $1)", [DAILY_CAP])
    expect(await recordCount(db, { mode: "tag", n: 1, day: "2026-10-25" })).toBe(true)
  })

  it("the database itself refuses a bad mode or a negative count", async () => {
    await expect(client.query("insert into daily_counts values ('2026-10-25', 'delete', 1)")).rejects.toThrow()
    await expect(client.query("insert into daily_counts values ('2026-10-25', 'tag', -1)")).rejects.toThrow()
  })

  it("stores nothing but the day, the mode and the number", async () => {
    const cols = await client.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'daily_counts' order by column_name",
    )
    expect(cols.rows.map((c) => c.column_name)).toEqual(["count", "day", "mode"])
  })
})

describe("readDailyCounts", () => {
  it("returns one entry per day, oldest first, with zeros for quiet modes and days", async () => {
    await recordCount(db, { mode: "clean", n: 4, day: "2026-10-24" })
    await recordCount(db, { mode: "tag", n: 1, day: "2026-10-25" })
    const rows = await readDailyCounts(db, { today: "2026-10-25", days: 3 })
    expect(rows).toEqual([
      { day: "2026-10-23", view: 0, clean: 0, tag: 0 },
      { day: "2026-10-24", view: 0, clean: 4, tag: 0 },
      { day: "2026-10-25", view: 0, clean: 0, tag: 1 },
    ])
  })

  it("leaves out days older than the window", async () => {
    await recordCount(db, { mode: "view", n: 9, day: "2026-09-01" })
    const rows = await readDailyCounts(db, { today: "2026-10-25", days: 7 })
    expect(rows).toHaveLength(7)
    expect(rows.every((r) => r.view === 0)).toBe(true)
  })
})
