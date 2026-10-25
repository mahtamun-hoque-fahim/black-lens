// @vitest-environment node
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { hashPassword } from "better-auth/crypto"
import { drizzle } from "drizzle-orm/pglite"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { buildOwnerSql } from "../../../../../scripts/owner-sql-lib.mjs"
import * as schema from "@/db/schema"
import { createAuth } from "@/lib/auth-config"

const state = vi.hoisted(() => ({ auth: null as unknown }))
vi.mock("@/lib/get-auth", () => ({ getAuth: () => state.auth }))

import * as route from "./route"

const SITE = "http://localhost:3000"
const PASSWORD = "correct horse battery staple"
let client: PGlite

beforeAll(async () => {
  client = new PGlite()
  await client.exec(readFileSync("db/schema.sql", "utf8"))
  await client.exec(buildOwnerSql({ id: "route-owner-1", email: "owner@example.com", hash: await hashPassword(PASSWORD) }))
  state.auth = createAuth(drizzle(client, { schema }), { secret: "y".repeat(40), baseURL: SITE })
})
afterAll(() => client.close())

// Each call gets its own made-up address, so Better Auth's sign-in rate limit (3 per 10 seconds per address)
// does not make one test fail because of the ones before it.
let caller = 0
const fresh = () => ({ "x-forwarded-for": `198.51.100.${++caller}` })

const signIn = (password: string, origin = SITE, base = SITE) =>
  route.POST(
    new Request(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", host: new URL(base).host, origin, ...fresh() },
      body: JSON.stringify({ email: "owner@example.com", password }),
    }),
  )

describe("/api/auth", () => {
  it("signs the owner in and sets a session cookie that scripts cannot read", async () => {
    const res = await signIn(PASSWORD)
    expect(res.status).toBe(200)
    const cookie = res.headers.get("set-cookie") ?? ""
    expect(cookie).toMatch(/session_token=/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it("refuses a wrong password", async () => {
    expect((await signIn("not the password")).status).toBeGreaterThanOrEqual(400)
  })

  it("refuses a sign-in that comes from another site, even with the right password", async () => {
    const res = await signIn(PASSWORD, "https://evil.example")
    expect(res.status).toBe(403)
    expect(res.headers.get("set-cookie")).toBeNull()
  })

  it("refuses a sign-in with no Origin at all", async () => {
    const res = await route.POST(
      new Request(`${SITE}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", host: "localhost:3000", ...fresh() },
        body: JSON.stringify({ email: "owner@example.com", password: PASSWORD }),
      }),
    )
    expect(res.status).toBe(403)
  })

  it("marks the cookie Secure on the real https address", async () => {
    const saved = state.auth
    const https = "https://black-lens.vercel.app"
    state.auth = createAuth(drizzle(client, { schema }), { secret: "z".repeat(40), baseURL: https })
    const res = await signIn(PASSWORD, https, https)
    state.auth = saved
    expect(res.status).toBe(200)
    expect(res.headers.get("set-cookie") ?? "").toMatch(/Secure/i)
  })

  it("slows down repeated sign-in attempts from one address", async () => {
    const same = { "x-forwarded-for": "203.0.113.77" }
    const attempt = () =>
      route.POST(
        new Request(`${SITE}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", host: "localhost:3000", origin: SITE, ...same },
          body: JSON.stringify({ email: "owner@example.com", password: "wrong password here" }),
        }),
      )
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) statuses.push((await attempt()).status)
    expect(statuses).toContain(429)
  })

  it("answers 404 to everything outside the three allowed calls, including sign-up", async () => {
    const res = await route.POST(
      new Request(`${SITE}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", host: "localhost:3000", origin: SITE, ...fresh() },
        body: JSON.stringify({ email: "x@example.com", password: "another long password", name: "X" }),
      }),
    )
    expect(res.status).toBe(404)
    const users = await client.query("select count(*)::int as n from \"user\"")
    expect((users.rows[0] as { n: number }).n).toBe(1)
    expect((await route.GET(new Request(`${SITE}/api/auth/list-sessions`))).status).toBe(404)
  })

  it("reports a session only to the person who has the cookie", async () => {
    const none = await route.GET(new Request(`${SITE}/api/auth/get-session`))
    expect(await none.text()).toMatch(/^(null)?$/)
    const login = await signIn(PASSWORD)
    expect(login.status).toBe(200)
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0]
    expect(cookie).toMatch(/session_token=/)
    const mine = await route.GET(new Request(`${SITE}/api/auth/get-session`, { headers: { cookie } }))
    expect(((await mine.json()) as { user: { email: string } }).user.email).toBe("owner@example.com")
  })

  it("answers 503, with no detail, when auth is not configured", async () => {
    const saved = state.auth
    state.auth = null
    const res = await signIn(PASSWORD)
    expect(res.status).toBe(503)
    expect(await res.text()).toBe("")
    state.auth = saved
  })
})
