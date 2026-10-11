"use client"

import { useEffect, useRef, useState } from "react"
import { batchZipEntries, chipForError, cleanFileName, errorMessage, noticesFor } from "@/lib/clean-file"
import { createRunner, type Runner } from "@/lib/clean-runner"
import { expandZips, planBatch, type Collected } from "@/lib/collect-files"
import { saveBytes, saveParts } from "@/lib/download"
import { isEmptyTags, normalizeTags } from "@/lib/metadata"
import { EMPTY_FORM, formToInput, type TagForm } from "@/lib/tag-form"
import { writeZip } from "@/lib/zip"
import type { Item, Outcome } from "./batch-item"
import { BatchPanel } from "./batch-panel"
import { BatchResult } from "./batch-result"
import { CleanResult } from "./clean-result"
import { DropZone } from "./drop-zone"
import { FileCard } from "./file-card"
import { ModeTabs, type Mode } from "./mode-tabs"
import { Notices } from "./notices"
import { QueueList } from "./queue-list"
import { TagPanel } from "./tag-panel"
import { ViewPanel } from "./view-panel"
import { Button } from "./button"
import { formatBytes } from "@/lib/clean-file"

const MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const
const EXTENSION = { jpeg: ".jpg", png: ".png", webp: ".webp" } as const
type Kind = "clean" | "tag"
const ZIP_NAMES = { clean: "black-lens-clean.zip", tag: "black-lens-tagged.zip" } as const
const SUFFIX = { clean: "clean", tag: "tagged" } as const
/** Which job produced a finished photo: Tag writes details, so only its result has a written list. */
const kindOf = (item: Item): Kind => (item.result?.written ? "tag" : "clean")

type State =
  | { step: "empty"; error: string | null; notices: string[] }
  | {
      step: "batch"
      items: Item[]
      selectedId: number
      removeIcc: boolean
      phase: "queue" | "done"
      /** Which job the finished batch was, so its result shows only in the matching mode. */
      doneKind: Kind | null
      progress: { done: number; total: number } | null
      notices: string[]
    }

export function Workspace() {
  const [state, setState] = useState<State>({ step: "empty", error: null, notices: [] })
  const [mode, setMode] = useState<Mode>("clean") // Clean is the default; View and Clean share the same photos
  const [tagForm, setTagForm] = useState<TagForm>(EMPTY_FORM) // the details typed in Tag mode
  const [applyToAll, setApplyToAll] = useState(true)
  const [itemForms, setItemForms] = useState<Record<number, TagForm>>({}) // per-photo details, used when "apply to all" is off
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

  // View mode reads a photo's details the first time that photo is looked at, not all of them up front.
  const viewed = state.step === "batch" ? (state.items.length === 1 ? state.items[0] : (state.items.find((i) => i.id === state.selectedId) ?? state.items[0])) : null
  const needsReport = mode === "view" && !!viewed && (viewed.status === "ready" || viewed.status === "done") && !viewed.report && !viewed.reportError
  const viewedId = viewed?.id
  const reading = useRef(new Set<number>()) // photos whose details are already being read, so the effect never asks twice
  useEffect(() => {
    if (!needsReport || viewedId === undefined || reading.current.has(viewedId)) return
    const file = state.step === "batch" ? state.items.find((i) => i.id === viewedId)?.file : undefined
    if (!file) return
    const run = runId.current
    reading.current.add(viewedId)
    getRunner()
      .inspect(file)
      .then((report) => run === runId.current && patch(viewedId, { report }))
      .catch((e) => run === runId.current && patch(viewedId, { reportError: errorMessage(e) }))
      .finally(() => reading.current.delete(viewedId))
    // The trigger is the photo and the mode; state, patch and getRunner are read at the moment it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsReport, viewedId])

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

    setState({ step: "batch", items, selectedId: items[0].id, removeIcc: false, phase: "queue", doneKind: null, progress: null, notices })

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

  // A finished photo shows its result only in the mode that produced it. Anywhere else it is ready to run
  // again, so a photo you cleaned can still be tagged without adding it a second time.
  const shown: Item[] = state.step === "batch" ? state.items.map((i) => (mode !== "view" && i.status === "done" && kindOf(i) !== mode ? { ...i, status: "ready" as const } : i)) : []
  const many = shown.length > 1
  const kindNow: Kind = mode === "tag" ? "tag" : "clean"
  const phaseDone = state.step === "batch" && state.phase === "done" && state.doneKind === kindNow
  const selected = state.step === "batch" ? (shown.find((i) => i.id === state.selectedId) ?? shown[0]) : undefined
  const perPhoto = many && !applyToAll
  const formFor = (item: Item): TagForm => (perPhoto ? (itemForms[item.id] ?? tagForm) : tagForm)

  const exec = (item: Item, kind: Kind, removeIcc: boolean): Promise<Outcome> =>
    kind === "tag" ? getRunner().tag(item.file, formToInput(formFor(item)), { removeIcc }) : getRunner().clean(item.file, { removeIcc })

  /** The one-photo flow: run the job and download the result directly. */
  async function runOne(kind: Kind) {
    if (state.step !== "batch") return
    const item = shown[0]
    if (!item || item.status !== "ready") return
    const run = runId.current
    patch(item.id, { status: "cleaning", error: undefined })
    try {
      const result = await exec(item, kind, state.removeIcc)
      if (run !== runId.current) return
      const outName = cleanFileName(item.name, EXTENSION[result.format], SUFFIX[kind])
      saveBytes(result.bytes, outName, MIME[result.format])
      patch(item.id, { status: "done", result, outName })
    } catch (e) {
      if (run !== runId.current) return
      patch(item.id, { status: "ready", error: errorMessage(e) })
    }
  }

  /** The batch flow: run the job on every ready photo in turn, then hand over one ZIP. */
  async function runAll(kind: Kind) {
    if (state.step !== "batch" || state.progress) return
    const run = runId.current
    const removeIcc = state.removeIcc
    const todo = shown.filter((i) => i.status === "ready")
    if (todo.length === 0) return

    setState((s) => (s.step === "batch" ? { ...s, progress: { done: 0, total: todo.length } } : s))
    const finished: { outName: string; bytes: Uint8Array }[] = []
    let count = 0
    for (const item of todo) {
      if (run !== runId.current) return
      patch(item.id, { status: "cleaning" })
      try {
        const result = await exec(item, kind, removeIcc)
        if (run !== runId.current) return
        const outName = cleanFileName(item.name, EXTENSION[result.format], SUFFIX[kind])
        finished.push({ outName, bytes: result.bytes })
        patch(item.id, { status: "done", result, outName })
      } catch (e) {
        if (run !== runId.current) return
        patch(item.id, { status: "error", error: errorMessage(e), chip: chipForError(e) })
      }
      count++
      setState((s) => (s.step === "batch" ? { ...s, progress: { done: count, total: todo.length } } : s))
    }

    if (finished.length > 0) saveParts(writeZip(batchZipEntries(finished)), ZIP_NAMES[kind], "application/zip")
    setState((s) => (s.step === "batch" ? { ...s, phase: "done", doneKind: kind, progress: null } : s))
  }

  function downloadZipAgain(kind: Kind) {
    const done = shown.filter((i) => i.status === "done" && i.result && kindOf(i) === kind).map((i) => ({ outName: i.outName!, bytes: i.result!.bytes }))
    if (done.length > 0) saveParts(writeZip(batchZipEntries(done)), ZIP_NAMES[kind], "application/zip")
  }

  /** Why Tag cannot start yet, in plain words, or null when it can. Field problems are shown next to the field itself. */
  function tagBlocker(): string | null {
    const ready = shown.filter((i) => i.status === "ready")
    if (ready.length === 0) return "No photo is ready to tag."
    for (const item of perPhoto ? ready : ready.slice(0, 1)) {
      const { tags, errors } = normalizeTags(formToInput(formFor(item)))
      if (errors.length > 0) return perPhoto ? `${item.name} has details that need fixing.` : "Fix the fields marked above."
      if (isEmptyTags(tags)) return perPhoto ? `${item.name} has nothing to write yet.` : "Fill in at least one field."
    }
    return null
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

  const select = (selectedId: number) => setState((x) => (x.step === "batch" ? { ...x, selectedId } : x))
  const setRemoveIcc = (removeIcc: boolean) => setState((x) => (x.step === "batch" ? { ...x, removeIcc } : x))

  const viewBody =
    state.step === "empty" ? (
      <div className="max-w-3xl">
        <DropZone onCollected={addFiles} error={state.error} notices={state.notices} />
      </div>
    ) : many ? (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{state.items.length} photos</h2>
            <Button variant="ghost" onClick={reset}>
              Clear all
            </Button>
          </div>
          <QueueList items={state.items} selectedId={state.selectedId} onSelect={select} onRemove={removeItem} locked={false} />
        </div>
        <section aria-label="Details" className="h-fit rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card">
          {viewed && <ViewPanel item={viewed} many onClean={() => setMode("clean")} />}
        </section>
      </div>
    ) : (
      <section aria-label="Details" className="max-w-3xl space-y-4 rounded-xl border border-primary bg-card p-6 text-card-foreground shadow-card">
        <Notices notices={state.notices} />
        {viewed && <ViewPanel item={viewed} many={false} onClean={() => setMode("clean")} onReset={reset} />}
      </section>
    )

  const runTag = () => (many ? runAll("tag") : runOne("tag"))
  const tagPanel = (item: Item) =>
    state.step === "batch" && (
      <TagPanel
        title={perPhoto ? item.name : null}
        form={formFor(item)}
        onChange={(form) => (perPhoto ? setItemForms((f) => ({ ...f, [item.id]: form })) : setTagForm(form))}
        many={many}
        applyToAll={applyToAll}
        onApplyToAll={setApplyToAll}
        blocker={tagBlocker()}
        hasProfile={shown.some((i) => i.summary?.colourProfile)}
        removeIcc={state.removeIcc}
        onRemoveIccChange={setRemoveIcc}
        progress={state.progress}
        onRun={runTag}
      />
    )

  const tagBody =
    state.step === "empty" ? (
      <div className="max-w-3xl">
        <DropZone onCollected={addFiles} error={state.error} notices={state.notices} />
      </div>
    ) : many ? (
      phaseDone ? (
        <BatchResult items={shown} onDownload={() => downloadZipAgain("tag")} onReset={reset} />
      ) : (
        <div className="space-y-6">
          <Notices notices={state.notices} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{shown.length} photos</h2>
                <Button variant="ghost" aria-disabled={state.progress !== null} onClick={() => state.progress === null && reset()}>
                  Clear all
                </Button>
              </div>
              <QueueList items={shown} selectedId={selected!.id} onSelect={select} onRemove={removeItem} locked={state.progress !== null} />
            </div>
            <section aria-label="Details" className="h-fit rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card">
              {selected && tagPanel(selected)}
            </section>
          </div>
        </div>
      )
    ) : (
      <div className="max-w-3xl space-y-4">
        <Notices notices={state.notices} />
        {(() => {
          const item = shown[0]
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
              <div className="space-y-6 rounded-xl border border-primary bg-card p-6 text-card-foreground shadow-card">
                <div className="min-w-0">
                  <p className="truncate font-mono text-base" title={item.name}>
                    {item.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatBytes(item.size)}</p>
                </div>
                {item.error && (
                  <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-foreground">
                    {item.error}
                  </p>
                )}
                {tagPanel(item)}
                <Button variant="ghost" onClick={reset}>
                  Choose another photo
                </Button>
              </div>
            )
          }
          return (
            <p role="status" className="text-muted-foreground">
              Reading your photo.
            </p>
          )
        })()}
      </div>
    )

  const cleanBody = (
    <div className={many ? undefined : "max-w-3xl"}>
      {state.step === "empty" && <DropZone onCollected={addFiles} error={state.error} notices={state.notices} />}

      {state.step === "batch" && !many && (
        <div className="space-y-4">
          <Notices notices={state.notices} />
          {(() => {
            const item = shown[0]
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
                  onRemoveIccChange={setRemoveIcc}
                  busy={item.status === "cleaning"}
                  error={item.error ?? null}
                  onClean={() => runOne("clean")}
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

      {state.step === "batch" && many && !phaseDone && (
        <BatchPanel
          items={shown}
          selectedId={selected!.id}
          onSelect={select}
          onRemove={removeItem}
          hasProfile={shown.some((i) => i.summary?.colourProfile)}
          removeIcc={state.removeIcc}
          onRemoveIccChange={setRemoveIcc}
          progress={state.progress}
          notices={state.notices}
          onCleanAll={() => runAll("clean")}
          onClear={reset}
        />
      )}

      {many && phaseDone && <BatchResult items={shown} onDownload={() => downloadZipAgain("clean")} onReset={reset} />}
    </div>
  )

  return <ModeTabs mode={mode} onModeChange={setMode} view={viewBody} clean={cleanBody} tag={tagBody} />
}
