import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BackToTop } from "./back-to-top"

// jsdom has no IntersectionObserver. This stand-in lets a test say "the top of the page is / is not on screen".
let callback: ((entries: { isIntersecting: boolean }[]) => void) | null = null
let disconnected = false
class FakeObserver {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    callback = cb
  }
  observe() {}
  disconnect() {
    disconnected = true
  }
}
const topOnScreen = (visible: boolean) => act(() => callback!([{ isIntersecting: visible }]))
const pageHeight = (height: number) => Object.defineProperty(document.documentElement, "scrollHeight", { value: height, configurable: true })

beforeEach(() => {
  callback = null
  disconnected = false
  vi.stubGlobal("IntersectionObserver", FakeObserver)
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true })
  window.scrollTo = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

describe("BackToTop", () => {
  it("is not there while the top of the page is on screen", () => {
    pageHeight(3000)
    render(<BackToTop />)
    topOnScreen(true)
    expect(screen.queryByRole("button", { name: "Back to top" })).not.toBeInTheDocument()
  })

  it("appears once the top has scrolled out of view on a long page", () => {
    pageHeight(3000)
    render(<BackToTop />)
    topOnScreen(false)
    expect(screen.getByRole("button", { name: "Back to top" })).toBeInTheDocument()
  })

  it("never appears on a page that fits the window", () => {
    pageHeight(850) // less than 1.2 times the window
    render(<BackToTop />)
    topOnScreen(false)
    expect(screen.queryByRole("button", { name: "Back to top" })).not.toBeInTheDocument()
  })

  it("scrolls to the top, smoothly unless the person prefers reduced motion", async () => {
    pageHeight(3000)
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as typeof window.matchMedia
    render(<BackToTop />)
    topOnScreen(false)
    await userEvent.setup().click(screen.getByRole("button", { name: "Back to top" }))
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" })
  })

  it("listens without a scroll handler, and lets go when it unmounts", () => {
    const add = vi.spyOn(window, "addEventListener")
    pageHeight(3000)
    const { unmount } = render(<BackToTop />)
    expect(add.mock.calls.map((c) => c[0])).not.toContain("scroll")
    unmount()
    expect(disconnected).toBe(true)
  })
})
