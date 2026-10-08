"use client"

import { useEffect, useRef, useState } from "react"
import { batchZipEntries, chipForError, cleanFileName, errorMessage, noticesFor } from "@/lib/clean-file"
import { createRunner, type Runner } from "@/lib/clean-runner"
import { expandZips, planBatch, type Collected } from "@/lib/collect-files"
import { saveBytes, saveParts } from "@/lib/download"
import { writeZip } from "@/lib/zip"
import type { Item } from "./batch-item"
import { BatchPanel } from "./batch-panel"
import { BatchResult } from "./batch-result"
import { CleanResult } from "./clean-result"
import { DropZone } from "./drop-zone"
import { FileCard } from "./file-card"
import { ModeTabs } from "./mode-tabs"
import { Notices } from "./notices"

const MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const
const EXTENSION = { jpeg: ".jpg", png: ".png", webp: ".webp" } as const
const ZIP_NAME = "black-lens-clean.zip"

type State =
  | { step: "empty"; error: string | null; notices: string[] }
  | {
      step: "batch"
      items: Item[]
      selectedId: number
      removeIcc: boolean
      phase: "queue" | "done"
      progress: { done: number; total: number } | null
      notices: string[]
    }

export function Workspace() {
  const [state, setState] = useState<State>({ step: "empty", error: null, notices: [] })
  const runId = useRef(0) // bumped on every new batch and every reset, so slow old work can tell it is out of date
  const idSeq = useRef(0)
  const runnerRef = useRef<Runner | null>(null)

  // Made on first use, not during render, so React's double render in development cannot start two workers.
  const getRunner = () => (runnerRef.current ??= createRunner())
  useEffect(
    () => () => {
      runnerRef.current?.dispose()
      runnerRef.current = null
    },
    [],
  )

  const patch = (id: number, change: Partial<Item>) =>
    setState((s) => (s.step === "batch" ? { ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...change } : i)) } : s))

  async function addFiles(collected: Collected) {
    const run = ++runId.current
    const expanded = await expandZips(collected.files)
    if (run !== runId.current) return

    const plan = planBatch(expanded.files)
    const notices = noticesFor({
      skipped: collected.skipped + expanded.skipped,
      truncated: collected.truncated,
      zipErrors: expanded.errors,
      planNotice: plan.notice,
    })

    if (plan.items.length === 0) {
      // Nothing to show: say why. A broken ZIP is the reason when there is one.
      const first = expanded.errors[0]
      const rest = noticesFor({
        skipped: collected.skipped + expanded.skipped,
        truncated: collected.truncated,
        zipErrors: expanded.errors.slice(1),
        planNotice: plan.notice,
      })
      setState({ step: "empty", error: first ?? "No photos were found in what you chose.", notices: rest })
      return
    }

    const items: Item[] = plan.items.map(({ file, error }) => ({
      id: ++idSeq.current,
      file,
      name: file.name,
      size: file.size,
      status: error ? "error" : "reading",
      error,
      chip: error ? "Too big" : undefined,
    }))

    if (items.length === 1 && items[0].status === "error") {
      setState({ step: "empty", error: items[0].error!, notices })
      return
    }

    setState({ step: "batch", items, selectedId: items[0].id, removeIcc: false, phase: "queue", progress: null, notices })

    // Read each photo in turn. The worker does the work off the main thread, so the page stays responsive.
    let lastError: string | null = null
    for (const item of items) {
      if (item.status !== "reading") continue
      try {
        const summary = await getRunner().summarize(item.file)
        if (run !== runId.current) return
        patch(item.id, { status: "ready", summary })
      } catch (e) {
        if (run !== runId.current) return
        lastError = errorMessage(e)
        patch(item.id, { status: "error", error: lastError, chip: chipForError(e) })
      }
    }
    // One photo that cannot be read is not a queue: go back to the drop zone and say why.
    if (items.length === 1 && lastError) setState({ step: "empty", error: lastError, notices })
  }

  /** The one-photo flow: clean it and download it directly. */
  async function cleanOne() {
    if (state.step !== "batch") return
    const item = state.items[0]
    if (!item || item.status !== "ready") return
    const run = runId.current
    patch(item.id, { status: "cleaning", error: undefined })
    try {
      const result = await getRunner().clean(item.file, { removeIcc: state.removeIcc })
      if (run !== runId.current) return
      const outName = cleanFileName(item.name, EXTENSION[result.format])
      saveBytes(result.bytes, outName, MIME[result.format])
      patch(item.id, { status: "done", result, outName })
    } catch (e) {
      if (run !== runId.current) return
      patch(item.id, { status: "ready", error: errorMessage(e) })
    }
  }

  /** The batch flow: clean every photo in turn, then hand over one ZIP. */
  async function cleanAll() {
    if (state.step !== "batch" || state.progress) return
    const run = runId.current
    const removeIcc = state.removeIcc
    const todo = state.items.filter((i) => i.status === "ready")
    if (todo.length === 0) return

    setState((s) => (s.step === "batch" ? { ...s, progress: { done: 0, total: todo.length } } : s))
    const finished: { outName: string; bytes: Uint8Array }[] = []
    let count = 0
    for (const item of todo) {
      if (run !== runId.current) return
      patch(item.id, { status: "cleaning" })
      try {
        const result = await getRunner().clean(item.file, { removeIcc })
        if (run !== runId.current) return
        const outName = cleanFileName(item.name, EXTENSION[result.format])
        finished.push({ outName, bytes: result.bytes })
        patch(item.id, { status: "done", result, outName })
      } catch (e) {
        if (run !== runId.current) return
        patch(item.id, { status: "error", error: errorMessage(e), chip: chipForError(e) })
      }
      count++
      setState((s) => (s.step === "batch" ? { ...s, progress: { done: count, total: todo.length } } : s))
    }

    if (finished.length > 0) saveParts(writeZip(batchZipEntries(finished)), ZIP_NAME, "application/zip")
    setState((s) => (s.step === "batch" ? { ...s, phase: "done", progress: null } : s))
  }

  function downloadZipAgain() {
    if (state.step !== "batch") return
    const done = state.items.filter((i) => i.status === "done" && i.result).map((i) => ({ outName: i.outName!, bytes: i.result!.bytes }))
    if (done.length > 0) saveParts(writeZip(batchZipEntries(done)), ZIP_NAME, "application/zip")
  }

  function removeItem(id: number) {
    setState((s) => {
      if (s.step !== "batch") return s
      const items = s.items.filter((i) => i.id !== id)
      if (items.length === 0) return { step: "empty", error: null, notices: [] }
      return { ...s, items, selectedId: s.selectedId === id ? items[0].id : s.selectedId }
    })
  }

  const reset = () => {
    runId.current++
    setState({ step: "empty", error: null, notices: [] })
  }

  const wide = state.step === "batch" && state.items.length > 1

  return (
    <ModeTabs
      clean={
        <div className={wide ? undefined : "max-w-3xl"}>
          {state.step === "empty" && <DropZone onCollected={addFiles} error={state.error} notices={state.notices} />}

          {state.step === "batch" && state.items.length === 1 && (
            <div className="space-y-4">
              <Notices notices={state.notices} />
              {(() => {
                const item = state.items[0]
                if (item.status === "done" && item.result && item.outName) {
                  return (
                    <CleanResult
                      name={item.name}
                      outName={item.outName}
                      originalSize={item.size}
                      result={item.result}
                      onDownload={() => saveBytes(item.result!.bytes, item.outName!, MIME[item.result!.format])}
                      onReset={reset}
                    />
                  )
                }
                if (item.summary && (item.status === "ready" || item.status === "cleaning")) {
                  return (
                    <FileCard
                      name={item.name}
                      size={item.size}
                      summary={item.summary}
                      removeIcc={state.removeIcc}
                      onRemoveIccChange={(removeIcc) => setState((s) => (s.step === "batch" ? { ...s, removeIcc } : s))}
                      busy={item.status === "cleaning"}
                      error={item.error ?? null}
                      onClean={cleanOne}
                      onReset={reset}
                    />
                  )
                }
                return (
                  <p role="status" className="text-muted-foreground">
                    Reading your photo.
                  </p>
                )
              })()}
            </div>
          )}

          {wide && state.phase === "queue" && (
            <BatchPanel
              items={state.items}
              selectedId={state.selectedId}
              onSelect={(selectedId) => setState((s) => (s.step === "batch" ? { ...s, selectedId } : s))}
              onRemove={removeItem}
              hasProfile={state.items.some((i) => i.summary?.colourProfile)}
              removeIcc={state.removeIcc}
              onRemoveIccChange={(removeIcc) => setState((s) => (s.step === "batch" ? { ...s, removeIcc } : s))}
              progress={state.progress}
              notices={state.notices}
              onCleanAll={cleanAll}
              onClear={reset}
            />
          )}

          {wide && state.phase === "done" && <BatchResult items={state.items} onDownload={downloadZipAgain} onReset={reset} />}
        </div>
      }
    />
  )
}
