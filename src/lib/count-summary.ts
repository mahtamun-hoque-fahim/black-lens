import { COUNT_MODES, type CountMode } from "@/db/schema"
import type { DayCounts } from "./counter"

const dayTotal = (r: DayCounts) => r.view + r.clean + r.tag

export function summarize(rows: DayCounts[]) {
  const totals = { view: 0, clean: 0, tag: 0 }
  let busiest: { day: string; total: number } | null = null
  let max = 0
  for (const r of rows) {
    for (const m of COUNT_MODES) totals[m] += r[m]
    const total = dayTotal(r)
    if (total > max) {
      max = total
      busiest = { day: r.day, total }
    }
  }
  return { totals, grand: totals.view + totals.clean + totals.tag, busiest, max }
}

export type Segment = { mode: CountMode; y: number; height: number }
export type Bar = { day: string; x: number; width: number; segments: Segment[] }

const MIN_SEGMENT = 2

/** Stacked columns, one per day, drawn bottom-up in View, Clean, Tag order. The busiest day fills the height. */
export function chartBars(rows: DayCounts[], { width, height, gap }: { width: number; height: number; gap: number }): Bar[] {
  if (rows.length === 0) return []
  const { max } = summarize(rows)
  const slot = width / rows.length
  return rows.map((r, i) => {
    let heights = COUNT_MODES.map((m) => (max === 0 || r[m] === 0 ? 0 : Math.max((r[m] / max) * height, MIN_SEGMENT)))
    const sum = heights.reduce((a, b) => a + b, 0)
    if (sum > height) heights = heights.map((h) => (h * height) / sum) // small segments were raised: shrink to fit
    let bottom = height
    const segments: Segment[] = []
    COUNT_MODES.forEach((mode, k) => {
      if (heights[k] === 0) return
      bottom -= heights[k]
      segments.push({ mode, y: bottom, height: heights[k] })
    })
    return { day: r.day, x: i * slot + gap / 2, width: Math.max(slot - gap, 1), segments }
  })
}
