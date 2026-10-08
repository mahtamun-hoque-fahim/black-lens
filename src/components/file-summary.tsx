import { MapPin } from "lucide-react"
import { foundItems, formatBytes } from "@/lib/clean-file"
import type { MetadataSummary } from "@/lib/metadata"
import { chipForSummary, type Chip } from "./batch-item"
import { StatusChip } from "./status-chip"

/** What one photo carries: name, size, chip, the location warning, and the list of what was found. */
export function FileSummary({ name, size, summary, chip }: { name: string; size: number; summary: MetadataSummary; chip?: Chip }) {
  const found = foundItems(summary)
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-base" title={name}>
            {name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{formatBytes(size)}</p>
        </div>
        <StatusChip chip={chip ?? chipForSummary(summary)} />
      </div>

      {summary.location && (
        <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p>This photo shows where it was taken.</p>
        </div>
      )}

      {found.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold">This photo carries</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {found.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground">This photo has nothing identifying to remove.</p>
      )}
    </div>
  )
}
