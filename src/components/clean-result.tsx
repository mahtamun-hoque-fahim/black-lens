"use client"

import { CircleCheck, Download } from "lucide-react"
import { useEffect, useRef } from "react"
import { formatBytes, keptLabel, removedLabel } from "@/lib/clean-file"
import type { StripMetadataResult } from "@/lib/metadata"
import { Button } from "./button"

export function CleanResult({
  name,
  outName,
  originalSize,
  result,
  onDownload,
  onReset,
}: {
  name: string
  outName: string
  originalSize: number
  result: StripMetadataResult
  onDownload: () => void
  onReset: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  // The screen just changed: move focus to the result so keyboard and screen reader users land on it.
  useEffect(() => heading.current?.focus(), [])

  return (
    <div className="space-y-6 rounded-xl border border-primary bg-card p-6 text-card-foreground shadow-card">
      <div className="flex gap-3">
        <CircleCheck aria-hidden="true" className="mt-1 size-6 shrink-0 text-success" />
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-hidden">
            All identifying metadata removed
          </h2>
          <p className="mt-2 text-muted-foreground">
            Checked again after cleaning: nothing identifying was found, and the image data is unchanged.
          </p>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {outName} ({formatBytes(originalSize)} to {formatBytes(result.bytes.length)})
          </p>
          <span className="sr-only">Cleaned copy of {name}</span>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold">Removed</h3>
          {result.removed.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {result.removed.map((r) => (
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
            {result.kept.map((k) => (
              <li key={k.kind}>{keptLabel(k)}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onDownload}>
          <Download aria-hidden="true" className="size-4" />
          Download again
        </Button>
        <Button variant="ghost" onClick={onReset}>
          Clean another photo
        </Button>
      </div>
    </div>
  )
}
