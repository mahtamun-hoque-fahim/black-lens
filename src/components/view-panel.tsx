"use client"

import { CircleAlert, MapPin } from "lucide-react"
import { formatBytes } from "@/lib/clean-file"
import { reportToText } from "@/lib/metadata"
import { chipForSummary, type Item } from "./batch-item"
import { Button } from "./button"
import { CopyAllButton, CopyButton } from "./copy-button"
import { StatusChip } from "./status-chip"

/** Sources worth naming next to a label. Plain EXIF and the file itself are the default, so they stay quiet. */
const NOTABLE_SOURCES = new Set(["XMP", "IPTC", "Text", "Comment"])

export function ViewPanel({
  item,
  many,
  onClean,
  onReset,
}: {
  item: Item
  /** More than one photo is loaded, so the button speaks about all of them. */
  many: boolean
  onClean: () => void
  onReset?: () => void
}) {
  const { summary, report } = item

  if (item.status === "reading") return <p className="text-muted-foreground">Reading this photo.</p>

  if (item.status === "error" || !summary) {
    return (
      <p role="alert" className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-foreground">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
        <span>{item.error ?? "This photo could not be read."}</span>
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-base" title={item.name}>
            {item.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{formatBytes(item.size)}</p>
        </div>
        <StatusChip chip={chipForSummary(summary)} />
      </div>

      {summary.location && (
        <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p>{report && !report.location ? "This photo has location data, but it could not be fully read." : "This photo shows where it was taken."}</p>
        </div>
      )}

      {item.reportError && (
        <p role="alert" className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-foreground">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
          <span>{item.reportError}</span>
        </p>
      )}

      {!report && !item.reportError && (
        <p role="status" className="text-muted-foreground">
          Reading the details.
        </p>
      )}

      {report && (
        <>
          {summary.alreadyClean && <p className="text-muted-foreground">Nothing identifying was found in this photo.</p>}

          {report.groups.map((group) => {
            const headingId = `group-${item.id}-${group.id}`
            return (
              <section key={group.id} aria-labelledby={headingId} className="space-y-1">
                <h3 id={headingId} className="text-lg font-semibold">
                  {group.label}
                </h3>
                <dl>
                  {group.fields.map((field) => (
                    <div
                      key={field.label}
                      className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-start gap-x-3 border-t border-border first:border-t-0 sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
                    >
                      <dt className="py-2 text-muted-foreground">
                        {field.label}
                        {NOTABLE_SOURCES.has(field.source) && <span className="ml-2 rounded-lg bg-muted px-1.5 py-0.5 text-xs">{field.source}</span>}
                      </dt>
                      <dd className="py-2 font-mono text-sm break-words">{field.value}</dd>
                      <CopyButton text={field.value} label={field.label} />
                    </div>
                  ))}
                </dl>
              </section>
            )
          })}
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={onClean}>{many ? "Clean all photos" : "Clean this photo"}</Button>
        {report && <CopyAllButton text={reportToText(report, item.name)} label="Copy everything" />}
        {onReset && (
          <Button variant="ghost" onClick={onReset}>
            Choose another photo
          </Button>
        )}
      </div>
    </div>
  )
}
