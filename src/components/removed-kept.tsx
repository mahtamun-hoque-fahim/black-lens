import { keptLabel, removedLabel } from "@/lib/clean-file"
import type { KeptItem, RemovedItem } from "@/lib/metadata"

export function RemovedKept({ removed, kept }: { removed: RemovedItem[]; kept: KeptItem[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="text-lg font-semibold">Removed</h3>
        {removed.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {removed.map((r) => (
              <li key={r.kind}>{removedLabel(r.kind)}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground">Nothing needed removing.</p>
        )}
      </div>
      <div>
        <h3 className="text-lg font-semibold">Kept</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          {kept.map((k) => (
            <li key={k.kind}>{keptLabel(k)}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
