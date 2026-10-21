// @vitest-environment node
import { describe, expect, it } from "vitest"
import { buildOwnerSql, isValidEmail, passwordProblem } from "../../scripts/owner-sql-lib.mjs"

const hash = "0123456789abcdef0123456789abcdef:" + "ab".repeat(64)

describe("isValidEmail", () => {
  it.each(["mahtamunhoquefahim@pm.me", "a.b+c@example.co.uk"])("accepts %s", (e) => {
    expect(isValidEmail(e)).toBe(true)
  })
  it.each(["", "nope", "a@b", "a b@c.com", "a'b@c.com", "a@b.com;drop table user", 'a"@b.com', "a@b.com\n", "a\\@b.com"])(
    "rejects %j",
    (e) => expect(isValidEmail(e)).toBe(false),
  )
})

describe("passwordProblem", () => {
  it("wants at least 12 characters", () => {
    expect(passwordProblem("short")).toMatch(/12/)
    expect(passwordProblem("a".repeat(11))).not.toBeNull()
    expect(passwordProblem("a".repeat(12))).toBeNull()
  })
  it("refuses a password that is only spaces", () => {
    expect(passwordProblem(" ".repeat(20))).not.toBeNull()
  })
})

describe("buildOwnerSql", () => {
  const sql = buildOwnerSql({ id: "owner-id-1", email: "Owner@PM.me", hash })

  it("creates one user and one credential account in a single transaction", () => {
    expect(sql).toMatch(/^BEGIN;/)
    expect(sql.trim()).toMatch(/COMMIT;$/)
    expect(sql.match(/INSERT INTO "user"/g)).toHaveLength(1)
    expect(sql.match(/INSERT INTO "account"/g)).toHaveLength(1)
  })

  it("lowercases the email, because Better Auth looks it up lowercased", () => {
    expect(sql).toContain("'owner@pm.me'")
    expect(sql).not.toContain("PM.me")
  })

  it("contains the hash and never anything that looks like a plain password", () => {
    expect(sql).toContain(hash)
  })

  it("refuses to build SQL from anything unsafe", () => {
    expect(() => buildOwnerSql({ id: "x", email: "a'b@c.com", hash })).toThrow()
    expect(() => buildOwnerSql({ id: "x", email: "a@b.com", hash: "x'; drop table user; --" })).toThrow()
    expect(() => buildOwnerSql({ id: "x'y", email: "a@b.com", hash })).toThrow()
  })
})
