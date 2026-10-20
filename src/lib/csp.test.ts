// @vitest-environment node
import { describe, expect, it } from "vitest"
import { buildCsp, makeNonce, nonceFromCsp } from "./csp"

const directives = (csp: string) =>
  Object.fromEntries(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/)
        return [name, values]
      }),
  )

describe("makeNonce", () => {
  it("gives a different value every time", () => {
    const seen = new Set(Array.from({ length: 200 }, () => makeNonce()))
    expect(seen.size).toBe(200)
  })

  it("is base64 text with at least 128 bits of randomness", () => {
    const n = makeNonce()
    expect(n).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
    expect(atob(n).length).toBeGreaterThanOrEqual(16)
  })
})

describe("buildCsp in production", () => {
  const csp = buildCsp({ nonce: "abc123", isDev: false })
  const d = directives(csp)

  it("allows scripts only from this site or with the nonce, and trusts what they load", () => {
    expect(d["script-src"]).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"])
  })

  it("never allows inline or eval scripts", () => {
    expect(d["script-src"].join(" ")).not.toMatch(/unsafe/)
  })

  it("never allows inline styles", () => {
    expect(d["style-src"]).toEqual(["'self'", "'nonce-abc123'"])
  })

  it("allows style attributes (Radix sets a few) but still no style elements without the nonce", () => {
    expect(d["style-src-attr"]).toEqual(["'unsafe-inline'"])
    expect(d["style-src-elem"]).toBeUndefined()
    expect(d["style-src"]).toEqual(["'self'", "'nonce-abc123'"])
  })

  it("keeps every request on this site, so nothing can be sent elsewhere", () => {
    expect(d["connect-src"]).toEqual(["'self'"])
    expect(d["default-src"]).toEqual(["'self'"])
  })

  it("lets the worker run from this site only", () => {
    expect(d["worker-src"]).toEqual(["'self'"])
  })

  it("blocks plugins, framing, and changes to base or form targets", () => {
    expect(d["object-src"]).toEqual(["'none'"])
    expect(d["frame-ancestors"]).toEqual(["'none'"])
    expect(d["base-uri"]).toEqual(["'self'"])
    expect(d["form-action"]).toEqual(["'self'"])
  })

  it("upgrades insecure requests", () => {
    expect(d).toHaveProperty("upgrade-insecure-requests")
  })

  it("has no wildcard and no remote host anywhere", () => {
    expect(csp).not.toMatch(/\*/)
    expect(csp).not.toMatch(/https?:/)
  })

  it("has each directive once", () => {
    const names = csp.split(";").map((x) => x.trim().split(/\s+/)[0]).filter(Boolean)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe("buildCsp in development", () => {
  const d = directives(buildCsp({ nonce: "abc123", isDev: true }))

  it("adds eval for React's debugging and inline styles for the dev overlay", () => {
    expect(d["script-src"]).toContain("'unsafe-eval'")
    expect(d["style-src"]).toContain("'unsafe-inline'")
  })

  it("does not force https on localhost", () => {
    expect(d).not.toHaveProperty("upgrade-insecure-requests")
  })
})

describe("buildCsp refuses a bad nonce", () => {
  it.each(["", "a b", "a'b", "a;b", "a\nb"])("rejects %j", (nonce) => {
    expect(() => buildCsp({ nonce, isDev: false })).toThrow()
  })
})

describe("nonceFromCsp", () => {
  it("reads back the nonce it was built with", () => {
    const n = makeNonce()
    expect(nonceFromCsp(buildCsp({ nonce: n, isDev: false }))).toBe(n)
  })

  it("returns null when there is no nonce", () => {
    expect(nonceFromCsp("default-src 'self'")).toBeNull()
    expect(nonceFromCsp(null)).toBeNull()
  })
})
