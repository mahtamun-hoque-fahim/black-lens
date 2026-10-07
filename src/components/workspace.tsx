"use client"

import { useRef, useState } from "react"
import { cleanFileName, errorMessage } from "@/lib/clean-file"
import { saveBytes } from "@/lib/download"
import { stripMetadata, summarizeMetadata, type MetadataSummary, type StripMetadataResult } from "@/lib/metadata"
import { CleanResult } from "./clean-result"
import { DropZone } from "./drop-zone"
import { FileCard } from "./file-card"
import { ModeTabs } from "./mode-tabs"

interface Loaded {
  name: string
  bytes: Uint8Array
  summary: MetadataSummary
}

type State =
  | { step: "empty"; error: string | null }
  | { step: "ready"; file: Loaded; removeIcc: boolean; busy: boolean; error: string | null }
  | { step: "done"; file: Loaded; outName: string; result: StripMetadataResult }

export function Workspace() {
  const [state, setState] = useState<State>({ step: "empty", error: null })
  const loadId = useRef(0)

  async function loadFile(file: File) {
    const id = ++loadId.current // a slow read of an older file must not overwrite a newer choice
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const summary = summarizeMetadata(bytes)
      if (id !== loadId.current) return
      setState({ step: "ready", file: { name: file.name, bytes, summary }, removeIcc: false, busy: false, error: null })
    } catch (e) {
      if (id !== loadId.current) return
      setState({ step: "empty", error: errorMessage(e) })
    }
  }

  async function clean() {
    if (state.step !== "ready" || state.busy) return
    const { file, removeIcc } = state
    setState({ ...state, busy: true, error: null })
    await new Promise((resolve) => setTimeout(resolve, 0)) // let "Cleaning" paint before the work starts
    try {
      const result = stripMetadata(file.bytes, { removeIcc })
      const outName = cleanFileName(file.name)
      saveBytes(result.bytes, outName, "image/jpeg")
      setState({ step: "done", file, outName, result })
    } catch (e) {
      setState({ step: "ready", file, removeIcc, busy: false, error: errorMessage(e) })
    }
  }

  const reset = () => {
    loadId.current++
    setState({ step: "empty", error: null })
  }

  return (
    <ModeTabs
      clean={
        <>
          {state.step === "empty" && <DropZone onFile={loadFile} error={state.error} />}
          {state.step === "ready" && (
            <FileCard
              name={state.file.name}
              size={state.file.bytes.length}
              summary={state.file.summary}
              removeIcc={state.removeIcc}
              onRemoveIccChange={(removeIcc) => setState({ ...state, removeIcc })}
              busy={state.busy}
              error={state.error}
              onClean={clean}
              onReset={reset}
            />
          )}
          {state.step === "done" && (
            <CleanResult
              name={state.file.name}
              outName={state.outName}
              originalSize={state.file.bytes.length}
              result={state.result}
              onDownload={() => saveBytes(state.result.bytes, state.outName, "image/jpeg")}
              onReset={reset}
            />
          )}
        </>
      }
    />
  )
}
