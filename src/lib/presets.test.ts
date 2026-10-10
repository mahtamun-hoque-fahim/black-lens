import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EMPTY_FORM, isBlankForm } from "./tag-form"
import { addPreset, loadPresets, MAX_PRESETS, storePresets } from "./presets"

const form = (over: Partial<typeof EMPTY_FORM> = {}) => ({ ...EMPTY_FORM, ...over })

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe("isBlankForm", () => {
  it("is true only when every field is empty or spaces", () => {
    expect(isBlankForm(EMPTY_FORM)).toBe(true)
    expect(isBlankForm(form({ artist: "   ", keywords: " , " }))).toBe(false) // commas are text; normalisation decides later
    expect(isBlankForm(form({ title: "x" }))).toBe(false)
    expect(isBlankForm(form({ artist: "  \n " }))).toBe(true)
  })
})

describe("storePresets and loadPresets", () => {
  it("round-trips presets through localStorage on this device", () => {
    const list = addPreset([], "Studio", form({ artist: "Fahim", keywords: "sea, boats" }))
    expect(storePresets(list)).toBe(true)
    const loaded = loadPresets()
    expect(loaded.available).toBe(true)
    expect(loaded.presets).toEqual(list)
  })

  it("starts empty and available when nothing is stored", () => {
    expect(loadPresets()).toEqual({ available: true, presets: [] })
  })

  it("is unavailable, not broken, when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(loadPresets()).toEqual({ available: false, presets: [] })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full")
    })
    expect(storePresets([])).toBe(false)
  })

  it("ignores damaged JSON and entries that are not presets, and keeps the good ones", () => {
    localStorage.setItem("black-lens:presets", "{not json")
    expect(loadPresets().presets).toEqual([])
    localStorage.setItem("black-lens:presets", JSON.stringify({ not: "an array" }))
    expect(loadPresets().presets).toEqual([])
    localStorage.setItem("black-lens:presets", JSON.stringify([{ id: "1", name: "Good", tags: { artist: "A", date: 5 } }, { nope: 1 }, "text", null, { name: "", tags: {} }, { name: 7, tags: {} }]))
    const { presets } = loadPresets()
    expect(presets).toHaveLength(1)
    expect(presets[0]).toMatchObject({ name: "Good", tags: { ...EMPTY_FORM, artist: "A" } }) // a number is not a date: it becomes empty
  })

  it("never loads more than the maximum", () => {
    const many = Array.from({ length: MAX_PRESETS + 5 }, (_, i) => ({ id: `${i}`, name: `P${i}`, tags: {} }))
    localStorage.setItem("black-lens:presets", JSON.stringify(many))
    expect(loadPresets().presets).toHaveLength(MAX_PRESETS)
  })
})

describe("addPreset", () => {
  it("trims and shortens the name, and gives every preset its own id", () => {
    const a = addPreset([], `  ${"n".repeat(100)}  `, form({ artist: "A" }))
    expect(a[0].name).toBe("n".repeat(60))
    const b = addPreset(a, "Other", form({ artist: "B" }))
    expect(new Set(b.map((p) => p.id)).size).toBe(2)
  })

  it("replaces a preset with the same name (ignoring case) instead of duplicating it", () => {
    const first = addPreset([], "Studio", form({ artist: "Old" }))
    const second = addPreset(first, "STUDIO", form({ artist: "New" }))
    expect(second).toHaveLength(1)
    expect(second[0].tags.artist).toBe("New")
    expect(second[0].id).toBe(first[0].id)
  })

  it("keeps the newest presets when it would go over the maximum", () => {
    let list = [] as ReturnType<typeof addPreset>
    for (let i = 0; i < MAX_PRESETS + 3; i++) list = addPreset(list, `P${i}`, form({ artist: `${i}` }))
    expect(list).toHaveLength(MAX_PRESETS)
    expect(list[list.length - 1].name).toBe(`P${MAX_PRESETS + 2}`)
    expect(list[0].name).toBe("P3")
  })
})
