// @vitest-environment node
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as schema from "@/db/schema"
import { DAILY_CAP, utcDay } from "@/lib/count-rules"

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock("@/db", () => ({ getDb: () => state.db }))

import * as route from "./route"

let client: PGlite
beforeAll(async () => {
  client = new PGlite()
  await client.exec(readFileSync("db/schema.sql", "utf8"))
})
beforeEach(async () => {
  await client.exec("delete from daily_counts")
  state.db = drizzle(client, { schema })
})
afterAll(() => client.close())

const SITE = "https://black-lens.vercel.app"
const post = (body: unknown, headers: Record<string, string> = {}, raw?: string) =>
  route.POST(
    new Request(`${SITE}/api/count`, {
      method: "POST",
      headers: { host: "black-lens.vercel.app", origin: SITE, "content-type": "application/json", ...headers },
      body: raw ?? JSON.stringify(body),
    }),
  )
const rows = async () => (await client.query<{ day: string; mode: string; count: number }>("select * from daily_counts")).rows

describe("POST /api/count", () => {
  it("counts a valid report for today (UTC) and answers with no body", async () => {
    const res = await post({ mode: "clean", n: 4 })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe("")
    const r = await rows()
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ mode: "clean", count: 4 })
    const day: unknown = r[0].day // PGlite hands a date column back as a Date at UTC midnight
    expect(day instanceof Date ? day.toISOString().slice(0, 10) : String(day).slice(0, 10)).toBe(utcDay(new Date()))
  })

  it("adds up across calls", async () => {
    await post({ mode: "tag", n: 2 })
    await post({ mode: "tag", n: 3 })
    expect((await rows())[0].count).toBe(5)
  })

  it("sets no cookie and is never cached", async () => {
    const res = await post({ mode: "view", n: 1 })
    expect(res.headers.get("set-cookie")).toBeNull()
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it.each([
    ["another site", { origin: "https://evil.example" }],
    ["no origin", { origin: "" }],
    ["a cross-site browser request", { "sec-fetch-site": "cross-site" }],
  ])("refuses %s with 403 and counts nothing", async (_l, headers) => {
    const res = await post({ mode: "clean", n: 1 }, headers)
    expect(res.status).toBe(403)
    expect(await rows()).toHaveLength(0)
  })

  it("refuses a body that is not JSON with 415", async () => {
    const res = await post({ mode: "clean", n: 1 }, { "content-type": "text/plain" })
    expect(res.status).toBe(415)
    expect(await rows()).toHaveLength(0)
  })

  it("refuses a too-large body with 413 before reading it as JSON", async () => {
    const res = await post(null, {}, JSON.stringify({ mode: "clean", n: 1, pad: "x".repeat(5000) }))
    expect(res.status).toBe(413)
    expect(await rows()).toHaveLength(0)
  })

  it.each([
    ["broken JSON", undefined, "{not json"],
    ["an unknown mode", { mode: "delete", n: 1 }, undefined],
    ["a negative number", { mode: "clean", n: -5 }, undefined],
    ["a huge number", { mode: "clean", n: 1_000_000 }, undefined],
    ["a file name smuggled in", { mode: "clean", n: 1, name: "holiday.jpg" }, undefined],
  ])("refuses %s with 400 and counts nothing", async (_l, body, raw) => {
    const res = await post(body, {}, raw)
    expect(res.status).toBe(400)
    expect(await res.text()).toBe("")
    expect(await rows()).toHaveLength(0)
  })

  it("answers 429 once the daily cap is reached, and the total stays put", async () => {
    await client.query("insert into daily_counts (day, mode, count) values ($1, 'clean', $2)", [utcDay(new Date()), DAILY_CAP])
    const res = await post({ mode: "clean", n: 1 })
    expect(res.status).toBe(429)
    expect((await rows())[0].count).toBe(DAILY_CAP)
  })

  it("answers 503 when no database is configured", async () => {
    state.db = null
    expect((await post({ mode: "clean", n: 1 })).status).toBe(503)
  })

  it("answers 503, with nothing about the cause, when the database fails", async () => {
    state.db = {
      insert: () => {
        throw new Error("password authentication failed for user neondb_owner")
      },
    }
    const res = await post({ mode: "clean", n: 1 })
    expect(res.status).toBe(503)
    expect(await res.text()).toBe("")
  })

  it("has no handler for other methods, so they get 405 from Next.js", () => {
    expect(Object.keys(route).filter((k) => /^(GET|PUT|PATCH|DELETE|HEAD)$/.test(k))).toEqual([])
  })

  it("runs on the Node runtime and is never statically built", () => {
    expect(route.dynamic).toBe("force-dynamic")
  })
})
