/** What Tag wrote, in plain label and value pairs. */
export function WrittenList({ written }: { written: { label: string; value: string }[] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold">Written</h3>
      <dl className="mt-2">
        {written.map((w) => (
          <div key={w.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 border-t border-border first:border-t-0 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <dt className="py-2 text-muted-foreground">{w.label}</dt>
            <dd className="py-2 font-mono text-sm break-words whitespace-pre-wrap">{w.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
