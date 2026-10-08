"use client"

import { CircleAlert } from "lucide-react"
import type { MetadataSummary } from "@/lib/metadata"
import { Button } from "./button"
import { FileSummary } from "./file-summary"
import { IccSwitch } from "./icc-switch"

export function FileCard({
  name,
  size,
  summary,
  removeIcc,
  onRemoveIccChange,
  busy,
  error,
  onClean,
  onReset,
}: {
  name: string
  size: number
  summary: MetadataSummary
  removeIcc: boolean
  onRemoveIccChange: (value: boolean) => void
  busy: boolean
  error: string | null
  onClean: () => void
  onReset: () => void
}) {
  const canClean = !summary.alreadyClean || (removeIcc && summary.colourProfile)

  return (
    <div className="space-y-6 rounded-xl border border-primary bg-card p-6 text-card-foreground shadow-card">
      <FileSummary name={name} size={size} summary={summary} />

      {summary.colourProfile && <IccSwitch checked={removeIcc} onCheckedChange={onRemoveIccChange} label="Also remove the colour profile" />}

      {error && (
        <p role="alert" className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-foreground">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
          <span>{error}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {canClean && (
          <Button aria-disabled={busy} onClick={() => !busy && onClean()}>
            {busy ? "Cleaning" : "Clean and download"}
          </Button>
        )}
        <Button variant="ghost" onClick={onReset}>
          Choose another photo
        </Button>
      </div>
    </div>
  )
}
