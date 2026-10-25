import { chartBars } from "@/lib/count-summary"
import type { DayCounts } from "@/lib/counter"

const W = 640
const H = 180
const FILL = { view: "fill-chart-1", clean: "fill-chart-2", tag: "fill-chart-3" } as const

/** Stacked daily columns drawn with SVG attributes only, so the page's style rules never need loosening. */
export function CountChart({ rows, max }: { rows: DayCounts[]; max: number }) {
  const bars = chartBars(rows, { width: W, height: H, gap: 4 })
  return (
    <svg
      viewBox={`0 0 ${W} ${H + 24}`}
      role="img"
      aria-label={`Photos processed per day over the last ${rows.length} days, busiest day ${max}. The same numbers are in the table below.`}
      className="h-auto w-full"
    >
      <line x1="0" y1={H + 0.5} x2={W} y2={H + 0.5} className="stroke-border" strokeWidth="1" />
      {bars.map((bar) =>
        bar.segments.map((s) => <rect key={`${bar.day}-${s.mode}`} x={bar.x} y={s.y} width={bar.width} height={s.height} className={FILL[s.mode]} />),
      )}
      <text x="0" y={H + 18} className="fill-muted-foreground" fontSize="12">
        {rows[0]?.day}
      </text>
      <text x={W} y={H + 18} textAnchor="end" className="fill-muted-foreground" fontSize="12">
        {rows[rows.length - 1]?.day}
      </text>
    </svg>
  )
}
