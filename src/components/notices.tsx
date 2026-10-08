/** Plain sentences about what happened while the files were gathered. Renders nothing when empty. */
export function Notices({ notices }: { notices: string[] }) {
  if (notices.length === 0) return null
  return (
    <div role="status" className="space-y-1 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
      {notices.map((n) => (
        <p key={n}>{n}</p>
      ))}
    </div>
  )
}
