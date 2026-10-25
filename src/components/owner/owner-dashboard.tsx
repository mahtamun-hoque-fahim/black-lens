import { summarize } from "@/lib/count-summary"
import type { DayCounts } from "@/lib/counter"
import { CountChart } from "./count-chart"
import { SignOutButton } from "./sign-out-button"

const MODES = [
  { key: "view", label: "View", swatch: "bg-chart-1" },
  { key: "clean", label: "Clean", swatch: "bg-chart-2" },
  { key: "tag", label: "Tag", swatch: "bg-chart-3" },
] as const

export function OwnerDashboard({ rows, email }: { rows: DayCounts[] | null; email: string }) {
  const summary = rows ? summarize(rows) : null
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Usage</h1>
          <p className="mt-2 text-muted-foreground">Photos processed in the last 30 days, counted per day in UTC.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{email}</span>
          <SignOutButton />
        </div>
      </div>

      <p className="max-w-prose text-sm text-muted-foreground">
        These numbers are reported by visitors’ browsers. They are not verified, so treat them as a rough guide.
      </p>

      {rows === null || summary === null ? (
        <p role="alert" className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card">
          Black Lens cannot reach the counter database right now.
        </p>
      ) : (
        <>
          <section aria-label="Totals" className="grid gap-4 sm:grid-cols-3">
            {MODES.map((m) => (
              <div key={m.key} className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span aria-hidden="true" className={`size-3 rounded-sm ${m.swatch}`} />
                  {m.label}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{summary.totals[m.key]}</p>
              </div>
            ))}
          </section>

          {summary.grand === 0 ? (
            <p className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card">No photos counted yet.</p>
          ) : (
            <>
              <section className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card">
                <CountChart rows={rows} max={summary.max} />
              </section>
              <div className="overflow-x-auto rounded-xl border border-border bg-card text-card-foreground shadow-card">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Photos processed per day, newest first</caption>
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th scope="col" className="px-4 py-3 font-medium">Day (UTC)</th>
                      <th scope="col" className="px-4 py-3 font-medium">View</th>
                      <th scope="col" className="px-4 py-3 font-medium">Clean</th>
                      <th scope="col" className="px-4 py-3 font-medium">Tag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].reverse().map((r) => (
                      <tr key={r.day} className="border-b border-border last:border-0">
                        <th scope="row" className="px-4 py-2 font-mono font-normal">{r.day}</th>
                        <td className="px-4 py-2 tabular-nums">{r.view}</td>
                        <td className="px-4 py-2 tabular-nums">{r.clean}</td>
                        <td className="px-4 py-2 tabular-nums">{r.tag}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
