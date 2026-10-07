"use client"

import { CircleAlert, MapPin } from "lucide-react"
import { Switch } from "radix-ui"
import type { MetadataSummary } from "@/lib/metadata"
import { foundItems, formatBytes } from "@/lib/clean-file"
import { cn } from "@/lib/utils"
import { Button } from "./button"

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
  const found = foundItems(summary)
  const canClean = !summary.alreadyClean || (removeIcc && summary.colourProfile)
  const chip = summary.location
    ? { text: "Has location", className: "bg-destructive/10 text-destructive" }
    : summary.alreadyClean
      ? { text: "Already clean", className: "bg-muted text-muted-foreground" }
      : { text: "Has metadata", className: "bg-muted text-muted-foreground" }

  return (
    <div className="space-y-6 rounded-xl border border-primary bg-card p-6 text-card-foreground shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-base" title={name}>
            {name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{formatBytes(size)}</p>
        </div>
        <span className={cn("inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-sm font-medium", chip.className)}>
          {chip.text}
        </span>
      </div>

      {summary.location && (
        <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p>This photo shows where it was taken.</p>
        </div>
      )}

      {found.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold">This photo carries</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {found.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground">This photo has nothing identifying to remove.</p>
      )}

      {summary.colourProfile && (
        <div className="flex items-start gap-3">
          <Switch.Root
            id="remove-icc"
            checked={removeIcc}
            onCheckedChange={onRemoveIccChange}
            aria-describedby="remove-icc-hint"
            className="mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-lg border border-input bg-secondary p-0.5 transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:bg-foreground motion-reduce:transition-none"
          >
            <Switch.Thumb className="block size-4.5 rounded-md bg-foreground transition-transform duration-150 data-[state=checked]:translate-x-5 data-[state=checked]:bg-background motion-reduce:transition-none" />
          </Switch.Root>
          <div>
            <label htmlFor="remove-icc" className="font-medium">
              Also remove the colour profile
            </label>
            <p id="remove-icc-hint" className="text-sm text-muted-foreground">
              Off by default. Photos can look slightly different without it.
            </p>
          </div>
        </div>
      )}

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
