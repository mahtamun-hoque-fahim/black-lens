"use client"

import { CircleAlert, ImageUp } from "lucide-react"
import { useRef, useState, type DragEvent } from "react"
import { collectFromDataTransfer, filterCandidates, type Collected } from "@/lib/collect-files"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Notices } from "./notices"

export function DropZone({
  onCollected,
  error,
  notices,
}: {
  onCollected: (collected: Collected) => void
  error: string | null
  notices: string[]
}) {
  const photos = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    // Called straight away, with nothing awaited first: the browser empties the dropped list at the first await.
    void collectFromDataTransfer(e.dataTransfer).then(onCollected)
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border-2 border-dashed border-input bg-card p-10 text-center transition-colors duration-150 motion-reduce:transition-none",
          over && "border-foreground bg-accent",
        )}
      >
        <ImageUp aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-lg font-medium">Drop photos here</p>
        <p className="mt-1 text-sm text-muted-foreground">or</p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <Button onClick={() => photos.current?.click()}>Choose photos</Button>
          <Button variant="secondary" onClick={() => folder.current?.click()}>
            Choose a folder
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">You can also drop a folder or a ZIP. Works with JPEG, PNG and WebP.</p>

        <input
          ref={photos}
          data-testid="file-input"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/zip,.zip"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) onCollected({ files, skipped: 0, truncated: false })
            e.target.value = "" // allow choosing the same files again
          }}
        />
        <input
          ref={folder}
          data-testid="folder-input"
          type="file"
          multiple
          {...({ webkitdirectory: "" } as Record<string, string>)}
          className="hidden"
          onChange={(e) => {
            const { files, skipped } = filterCandidates(Array.from(e.target.files ?? []))
            if (files.length || skipped) onCollected({ files, skipped, truncated: false })
            e.target.value = ""
          }}
        />
      </div>

      {error && (
        <p role="alert" className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-foreground">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
          <span>{error}</span>
        </p>
      )}
      <Notices notices={notices} />
    </div>
  )
}
