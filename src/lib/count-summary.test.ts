// @vitest-environment node
import { describe, expect, it } from "vitest"
import { chartBars, summarize } from "./count-summary"
import type { DayCounts } from "./counter"

const day = (d: string, view: number, clean: number, tag: number): DayCounts => ({ day: d, view, clean, tag })
const rows = [day("2026-10-23", 0, 0, 0), day("2026-10-24", 2, 10, 0), day("2026-10-25", 1, 5, 4)]

describe("summarize", () => {
  it("adds up each mode and everything", () => {
    expect(summarize(rows)).toMatchObject({ totals: { view: 3, clean: 15, tag: 4 }, grand: 22 })
  })
  it("finds the busiest day", () => {
    expect(summarize(rows).busiest).toEqual({ day: "2026-10-24", total: 12 })
  })
  it("handles no data at all", () => {
    expect(summarize([])).toEqual({ totals: { view: 0, clean: 0, tag: 0 }, grand: 0, busiest: null, max: 0 })
    expect(summarize([day("2026-10-25", 0, 0, 0)]).busiest).toBeNull()
  })
  it("gives the tallest day's total as the chart's scale", () => {
    expect(summarize(rows).max).toBe(12)
  })
})

describe("chartBars", () => {
  const geo = { width: 300, height: 100, gap: 4 }
  const bars = chartBars(rows, geo)

  it("makes one column per day, in order, inside the width", () => {
    expect(bars.map((b) => b.day)).toEqual(rows.map((r) => r.day))
    for (const b of bars) {
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.x + b.width).toBeLessThanOrEqual(geo.width + 0.001)
    }
    expect(bars[1].x).toBeGreaterThan(bars[0].x)
  })

  it("draws nothing for a quiet day", () => {
    expect(bars[0].segments).toEqual([])
  })

  it("stacks the segments from the bottom, without gaps or overlaps, within the height", () => {
    const b = bars[2]
    expect(b.segments.map((s) => s.mode)).toEqual(["view", "clean", "tag"])
    let bottom = geo.height
    for (const s of b.segments) {
      expect(s.y + s.height).toBeCloseTo(bottom, 5)
      bottom = s.y
    }
    expect(bottom).toBeGreaterThanOrEqual(0)
  })

  it("scales heights to the busiest day, so that day fills the chart", () => {
    const top = bars[1].segments.reduce((sum, s) => sum + s.height, 0)
    expect(top).toBeCloseTo(geo.height, 3)
    const h = (b: (typeof bars)[number]) => b.segments.reduce((sum, s) => sum + s.height, 0)
    expect(h(bars[2]) / h(bars[1])).toBeCloseTo(10 / 12, 2)
  })

  it("keeps a tiny count visible", () => {
    const small = chartBars([day("a", 0, 1, 0), day("b", 0, 1000, 0)], geo)
    expect(small[0].segments[0].height).toBeGreaterThanOrEqual(2)
  })

  it("does not crash with no days or all zeros", () => {
    expect(chartBars([], geo)).toEqual([])
    expect(chartBars([day("a", 0, 0, 0)], geo)[0].segments).toEqual([])
  })
})
