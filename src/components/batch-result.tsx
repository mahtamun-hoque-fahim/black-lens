"use client"

import { CircleCheck, Download } from "lucide-react"
import { useEffect, useRef } from "react"
import type { KeptItem, RemovedItem } from "@/lib/metadata"
import type { Item } from "./batch-item"
import { Button } from "./button"
import { RemovedKept } from "./removed-kept"

/** Combine what happened across all photos, listing each kind once. */
function union<T extends { kind: string }>(lists: T[][]): T[] {
  const seen = new Map<string, T>()
  for (const list of lists) for (const entry of list) if (!seen.has(entry.kind)) seen.set(entry.kind, entry)
  return [...seen.values()]
}

export function BatchResult({
  items,
  onDownload,
  onReset,
}: {
  items: Item[]
  onDownload: () => void
  onReset: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])

  const done = items.filter((i) => i.status === "done" && i.result)
  const failed = items.filter((i) => i.status === "error")
  const removed = union<RemovedItem>(done.map((i) => i.result!.removed))
  const kept = union<KeptItem>(done.map((i) => i.result!.kept))

  const title =
    done.length === 0
      ? "No photos could be cleaned"
      : failed.length === 0
        ? `All identifying metadata removed from ${done.length} photos`
        : `Cleaned ${done.length} of ${items.length} photos`

  return (
    <div className="space-y-6 rounded-xl border border-primary bg-card p-6 text-card-foreground shadow-card">
      <div className="flex gap-3">
        {done.length > 0 && <CircleCheck aria-hidden="true" className="mt-1 size-6 shrink-0 text-success" />}
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-hidden">
            {title}
          </h2>
          {done.length > 0 && (
            <p className="mt-2 text-muted-foreground">
              Each photo was checked again after cleaning: nothing identifying was found, and the image data is unchanged.
              The ZIP holds the cleaned copies. Your originals are untouched.
            </p>
          )}
        </div>
      </div>

      {failed.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold">Not cleaned</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {failed.map((i) => (
              <li key={i.id}>
                <span className="font-mono">{i.name}</span>
                <span>: {i.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {done.length > 0 && <RemovedKept removed={removed} kept={kept} />}

      <div className="flex flex-wrap gap-3">
        {done.length > 0 && (
          <Button variant="secondary" onClick={onDownload}>
            <Download aria-hidden="true" className="size-4" />
            Download ZIP again
          </Button>
        )}
        <Button variant="ghost" onClick={onReset}>
          Clean more photos
        </Button>
      </div>
    </div>
  )
}
