"use client"

import { CircleCheck, Download } from "lucide-react"
import { useEffect, useRef } from "react"
import { formatBytes } from "@/lib/clean-file"
import type { StripMetadataResult } from "@/lib/metadata"
import { Button } from "./button"
import { RemovedKept } from "./removed-kept"

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

      <RemovedKept removed={result.removed} kept={result.kept} />

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
