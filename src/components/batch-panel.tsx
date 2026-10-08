"use client"

import { CircleAlert } from "lucide-react"
import type { Item } from "./batch-item"
import { Button } from "./button"
import { FileSummary } from "./file-summary"
import { IccSwitch } from "./icc-switch"
import { Notices } from "./notices"
import { QueueList } from "./queue-list"
import { RemovedKept } from "./removed-kept"

function Inspector({ item }: { item: Item }) {
  if (item.status === "reading") return <p className="text-muted-foreground">Reading this photo.</p>

  if (item.status === "error" || !item.summary) {
    return (
      <div className="space-y-3">
        <p className="truncate font-mono text-base" title={item.name}>
          {item.name}
        </p>
        <p role="alert" className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-foreground">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
          <span>{item.error ?? "This photo could not be read."}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FileSummary
        name={item.name}
        size={item.size}
        summary={item.summary}
        chip={item.status === "done" ? { text: "Cleaned", tone: "neutral" } : undefined}
      />
      {item.status === "done" && item.result && <RemovedKept removed={item.result.removed} kept={item.result.kept} />}
    </div>
  )
}

export function BatchPanel({
  items,
  selectedId,
  onSelect,
  onRemove,
  hasProfile,
  removeIcc,
  onRemoveIccChange,
  progress,
  notices,
  onCleanAll,
  onClear,
}: {
  items: Item[]
  selectedId: number
  onSelect: (id: number) => void
  onRemove: (id: number) => void
  hasProfile: boolean
  removeIcc: boolean
  onRemoveIccChange: (value: boolean) => void
  progress: { done: number; total: number } | null
  notices: string[]
  onCleanAll: () => void
  onClear: () => void
}) {
  const running = progress !== null
  const selected = items.find((i) => i.id === selectedId) ?? items[0]
  const canClean = items.some((i) => i.status === "ready") && !items.some((i) => i.status === "reading")
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="space-y-6">
      <Notices notices={notices} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{items.length} photos</h2>
            <Button variant="ghost" aria-disabled={running} onClick={() => !running && onClear()}>
              Clear all
            </Button>
          </div>
          <QueueList items={items} selectedId={selected.id} onSelect={onSelect} onRemove={onRemove} locked={running} />
        </div>

        <section aria-label="Details" className="h-fit rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card">
          <Inspector item={selected} />
        </section>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-card-foreground">
        {hasProfile && <IccSwitch checked={removeIcc} onCheckedChange={onRemoveIccChange} label="Also remove the colour profiles" />}

        {running && (
          <div className="space-y-2">
            <div
              role="progressbar"
              aria-label="Cleaning progress"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              className="h-2 w-full overflow-hidden rounded-lg bg-muted"
            >
              <div
                className="h-full rounded-lg bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p role="status" className="text-sm text-muted-foreground">
              Cleaning {Math.min(progress.done + 1, progress.total)} of {progress.total}
            </p>
          </div>
        )}

        <Button aria-disabled={running || !canClean} onClick={() => !running && canClean && onCleanAll()}>
          {running ? "Cleaning" : "Clean all and download ZIP"}
        </Button>
      </div>
    </div>
  )
}
