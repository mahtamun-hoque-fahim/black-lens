// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { email: string } },
  db: null as unknown,
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`)
  }),
}))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, useRouter: () => ({}) }))
vi.mock("@/lib/owner-session", () => ({ getOwnerSession: async () => mocks.session }))
vi.mock("@/db", () => ({ getDb: () => mocks.db }))
vi.mock("@/lib/counter", () => ({ readDailyCounts: vi.fn(async () => []) }))

import OwnerPage from "./page"
import SignInPage from "./sign-in/page"
import * as layout from "./layout"

beforeEach(() => {
  mocks.session = null
  mocks.db = {}
  mocks.redirect.mockClear()
})

describe("owner pages", () => {
  it("sends a visitor with no session to the sign-in page, without touching the database", async () => {
    mocks.db = { explode: true }
    await expect(OwnerPage()).rejects.toThrow("REDIRECT:/owner/sign-in")
  })

  it("shows the dashboard to the signed-in owner", async () => {
    mocks.session = { user: { email: "owner@example.com" } }
    const page = await OwnerPage()
    expect(page).toBeTruthy()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it("sends an owner who is already signed in from the sign-in page to the dashboard", async () => {
    mocks.session = { user: { email: "owner@example.com" } }
    await expect(SignInPage()).rejects.toThrow("REDIRECT:/owner")
  })

  it("shows the sign-in form to everyone else", async () => {
    expect(await SignInPage()).toBeTruthy()
  })

  it("keeps every owner page out of search results", () => {
    expect(layout.metadata.robots).toEqual({ index: false, follow: false })
  })

  it("is never built ahead of time or cached", async () => {
    const page = await import("./page")
    expect(page.dynamic).toBe("force-dynamic")
  })
})
