import { afterEach, describe, expect, it, vi } from "vitest"
import { copyText } from "./clipboard"

afterEach(() => vi.restoreAllMocks())

describe("copyText", () => {
  it("uses the clipboard API when there is one", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    expect(await copyText("hello")).toBe(true)
    expect(writeText).toHaveBeenCalledWith("hello")
  })

  it("falls back to a hidden text box when the clipboard API is missing or refuses", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true })
    let copied = ""
    document.execCommand = vi.fn(() => {
      copied = (document.activeElement as HTMLTextAreaElement).value
      return true
    })
    expect(await copyText("fallback text")).toBe(true)
    expect(copied).toBe("fallback text")
    expect(document.querySelector("textarea")).toBeNull() // cleaned up
  })

  it("reports failure instead of pretending", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true })
    document.execCommand = vi.fn(() => false)
    expect(await copyText("x")).toBe(false)
  })
})
