"use client"

import { CircleAlert, ImageUp } from "lucide-react"
import { useRef, useState, type DragEvent } from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

export function DropZone({ onFile, error }: { onFile: (file: File) => void; error: string | null }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
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
        <p className="mt-3 text-lg font-medium">Drop a photo here</p>
        <p className="mt-1 text-sm text-muted-foreground">or</p>
        <Button className="mt-3" onClick={() => input.current?.click()}>
          Choose a photo
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          Works with JPEG photos for now. PNG and WebP are on the way. One photo at a time.
        </p>
        <input
          ref={input}
          data-testid="file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = "" // allow choosing the same file again
          }}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-foreground"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
