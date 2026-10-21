// @vitest-environment node
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { getTableConfig } from "drizzle-orm/pg-core"
import { drizzle } from "drizzle-orm/pglite"
import { hashPassword } from "better-auth/crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildOwnerSql } from "../../scripts/owner-sql-lib.mjs"
import * as schema from "@/db/schema"
import { createAuth } from "./auth-config"

// The real Postgres engine (in memory), the exact setup file and owner SQL that go into the Neon editor.
const PASSWORD = "correct horse battery staple"
const EMAIL = "owner@example.com"

let client: PGlite
let db: ReturnType<typeof drizzle<typeof schema>>
let auth: ReturnType<typeof createAuth>

beforeAll(async () => {
  client = new PGlite()
  await client.exec(readFileSync("db/schema.sql", "utf8"))
  await client.exec(buildOwnerSql({ id: "owner-test-id", email: EMAIL, hash: await hashPassword(PASSWORD) }))
  db = drizzle(client, { schema })
  auth = createAuth(db, { secret: "x".repeat(40), baseURL: "http://localhost:3000" })
})
afterAll(() => client.close())

describe("db/schema.sql matches src/db/schema.ts", () => {
  it("has every table and column the code expects", async () => {
    for (const table of [schema.user, schema.session, schema.account, schema.verification, schema.dailyCounts]) {
      const cfg = getTableConfig(table)
      const res = await client.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1",
        [cfg.name],
      )
      expect(res.rows.map((r) => r.column_name).sort(), cfg.name).toEqual(cfg.columns.map((c) => c.name).sort())
    }
  })
})

describe("the owner SQL and Better Auth", () => {
  it("lets the owner sign in with the password that was hashed", async () => {
    const res = await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } })
    expect(res.user.email).toBe(EMAIL)
    expect(res.token).toBeTruthy()
  })

  it("accepts the email in any letter case", async () => {
    const res = await auth.api.signInEmail({ body: { email: "OWNER@Example.com", password: PASSWORD } })
    expect(res.user.email).toBe(EMAIL)
  })

  it("rejects a wrong password", async () => {
    await expect(auth.api.signInEmail({ body: { email: EMAIL, password: "wrong password here" } })).rejects.toThrow()
  })

  it("rejects an unknown email", async () => {
    await expect(auth.api.signInEmail({ body: { email: "other@example.com", password: PASSWORD } })).rejects.toThrow()
  })

  it("does not let anyone sign up", async () => {
    await expect(
      auth.api.signUpEmail({ body: { email: "new@example.com", password: "another long password", name: "New" } }),
    ).rejects.toThrow()
    const rows = await client.query("select count(*)::int as n from \"user\"")
    expect((rows.rows[0] as { n: number }).n).toBe(1)
  })

  it("never stores an IP address or browser string in the session", async () => {
    await auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      headers: new Headers({ "x-forwarded-for": "203.0.113.9", "user-agent": "TestBrowser/1.0" }),
    })
    const rows = await client.query<{ ip_address: string | null; user_agent: string | null }>(
      "select ip_address, user_agent from session",
    )
    expect(rows.rows.length).toBeGreaterThan(0)
    for (const r of rows.rows) {
      expect(r.ip_address).toBeNull()
      expect(r.user_agent).toBeNull()
    }
  })

  it("refuses a second run of the owner SQL for the same email", async () => {
    await expect(
      client.exec(buildOwnerSql({ id: "owner-test-2", email: EMAIL, hash: await hashPassword("another password 1") })),
    ).rejects.toThrow(/duplicate|unique/i)
    // The failed script left its transaction open; a real editor session ends and rolls it back.
    await client.exec("ROLLBACK")
    const rows = await client.query("select count(*)::int as n from \"user\"")
    expect((rows.rows[0] as { n: number }).n).toBe(1)
    const accounts = await client.query("select count(*)::int as n from account")
    expect((accounts.rows[0] as { n: number }).n).toBe(1)
  })
})
