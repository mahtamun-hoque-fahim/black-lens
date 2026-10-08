"use client"

import { X } from "lucide-react"
import { formatBytes } from "@/lib/clean-file"
import { cn } from "@/lib/utils"
import { chipForItem, type Item } from "./batch-item"
import { StatusChip } from "./status-chip"

export function QueueList({
  items,
  selectedId,
  onSelect,
  onRemove,
  locked,
}: {
  items: Item[]
  selectedId: number
  onSelect: (id: number) => void
  onRemove: (id: number) => void
  /** True while cleaning: rows can still be looked at but not removed. */
  locked: boolean
}) {
  return (
    <ul role="list" aria-label="Photos" className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
      {items.map((item) => {
        const selected = item.id === selectedId
        return (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-1 rounded-xl border bg-card p-1 text-card-foreground transition-colors duration-150 motion-reduce:transition-none",
              selected ? "border-primary" : "border-border",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={selected ? "true" : undefined}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg p-2 text-left hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-sm">{item.name}</span>
                <span className="block text-sm text-muted-foreground">{formatBytes(item.size)}</span>
              </span>
              <StatusChip chip={chipForItem(item)} />
            </button>
            <button
              type="button"
              aria-label={`Remove ${item.name}`}
              aria-disabled={locked}
              onClick={() => !locked && onRemove(item.id)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring aria-disabled:opacity-40 motion-reduce:transition-none"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
