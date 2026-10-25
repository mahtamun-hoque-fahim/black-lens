// @vitest-environment node
import { describe, expect, it } from "vitest"
import { isSameOrigin } from "./same-origin"

const h = (o: Record<string, string>) => new Headers(o)

describe("isSameOrigin", () => {
  it("accepts a request from the site's own page", () => {
    expect(isSameOrigin(h({ host: "black-lens.vercel.app", origin: "https://black-lens.vercel.app" }))).toBe(true)
    expect(isSameOrigin(h({ host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }))).toBe(true)
  })
  it("rejects another site", () => {
    expect(isSameOrigin(h({ host: "black-lens.vercel.app", origin: "https://evil.example" }))).toBe(false)
  })
  it("rejects a look-alike host", () => {
    expect(isSameOrigin(h({ host: "black-lens.vercel.app", origin: "https://black-lens.vercel.app.evil.example" }))).toBe(false)
    expect(isSameOrigin(h({ host: "black-lens.vercel.app", origin: "https://xblack-lens.vercel.app" }))).toBe(false)
  })
  it("rejects a missing, empty or unreadable Origin", () => {
    expect(isSameOrigin(h({ host: "black-lens.vercel.app" }))).toBe(false)
    expect(isSameOrigin(h({ host: "black-lens.vercel.app", origin: "" }))).toBe(false)
    expect(isSameOrigin(h({ host: "black-lens.vercel.app", origin: "null" }))).toBe(false)
    expect(isSameOrigin(h({ host: "black-lens.vercel.app", origin: "not a url" }))).toBe(false)
  })
  it("rejects when the browser itself says the request is cross-site", () => {
    expect(isSameOrigin(h({ host: "a.test", origin: "https://a.test", "sec-fetch-site": "cross-site" }))).toBe(false)
    expect(isSameOrigin(h({ host: "a.test", origin: "https://a.test", "sec-fetch-site": "same-site" }))).toBe(false)
  })
  it("rejects when there is no Host to compare against", () => {
    expect(isSameOrigin(h({ origin: "https://a.test" }))).toBe(false)
  })
})
