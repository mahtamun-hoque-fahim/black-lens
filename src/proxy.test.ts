// @vitest-environment node
import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { config, proxy } from "./proxy"

const run = (path = "/") => proxy(new NextRequest(`https://blacklens.test${path}`))

describe("proxy", () => {
  it("sets a CSP header on the response", () => {
    const csp = run().headers.get("content-security-policy")
    expect(csp).toContain("script-src 'self' 'nonce-")
    expect(csp).toContain("connect-src 'self'")
  })

  it("uses a new nonce for every request", () => {
    const pick = () => run().headers.get("content-security-policy")!.match(/'nonce-([^']+)'/)![1]
    expect(pick()).not.toBe(pick())
  })

  it("hands the same policy to the page render, which is how Next.js finds the nonce", () => {
    const res = run()
    const forwarded = res.headers.get("x-middleware-request-content-security-policy")
    expect(forwarded).toBe(res.headers.get("content-security-policy"))
  })

  it("does not trust a CSP or nonce sent by the visitor", () => {
    const req = new NextRequest("https://blacklens.test/", {
      headers: { "content-security-policy": "script-src *", "x-nonce": "attacker" },
    })
    const res = proxy(req)
    expect(res.headers.get("content-security-policy")).not.toContain("*")
    expect(res.headers.get("x-middleware-request-x-nonce")).not.toBe("attacker")
  })

  it("skips static files and prefetches", () => {
    const entry = config.matcher[0] as { source: string; missing: { key: string }[] }
    expect(entry.source).toContain("_next/static")
    expect(entry.source).toContain("_next/image")
    expect(entry.missing.map((m) => m.key)).toContain("next-router-prefetch")
  })
})
