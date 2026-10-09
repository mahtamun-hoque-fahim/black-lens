"use client"

import { Check, Copy } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { copyText } from "@/lib/clipboard"
import { Button } from "./button"

type Status = "idle" | "copied" | "failed"

function useCopy() {
  const [status, setStatus] = useState<Status>("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async (text: string) => {
    setStatus((await copyText(text)) ? "copied" : "failed")
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus("idle"), 1500)
  }
  return { status, copy }
}

/** What a screen reader hears after pressing a copy button. Always in the page, so the change is announced. */
function Announcement({ status }: { status: Status }) {
  return (
    <span role="status" className="sr-only">
      {status === "copied" ? "Copied" : status === "failed" ? "Could not copy" : ""}
    </span>
  )
}

/** An icon-only button that copies one value. A 44px target, named "Copy <field>". */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const { status, copy } = useCopy()
  return (
    <span className="inline-flex">
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={() => void copy(text)}
        className="-my-1 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none print:hidden"
      >
        {status === "copied" ? <Check aria-hidden="true" className="size-4 text-success" /> : <Copy aria-hidden="true" className="size-4" />}
      </button>
      <Announcement status={status} />
    </span>
  )
}

/** A labelled button that copies a whole block of text. */
export function CopyAllButton({ text, label }: { text: string; label: string }) {
  const { status, copy } = useCopy()
  return (
    <span className="inline-flex">
      <Button variant="secondary" onClick={() => void copy(text)}>
        {status === "copied" ? <Check aria-hidden="true" className="size-4 text-success" /> : <Copy aria-hidden="true" className="size-4" />}
        {label}
      </Button>
      <Announcement status={status} />
    </span>
  )
}
