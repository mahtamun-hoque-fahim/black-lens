/** The brand red is for progress, so this is one of the places it is allowed. Text is read out as it changes. */
export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="space-y-2">
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-2 w-full overflow-hidden rounded-lg bg-muted">
        <div className="h-full rounded-lg bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        Working on {Math.min(done + 1, total)} of {total}
      </p>
    </div>
  )
}
