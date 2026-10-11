"use client"

import { useState } from "react"
import { addPreset, loadPresets, storePresets, type Preset } from "@/lib/presets"
import { isBlankForm, type TagForm } from "@/lib/tag-form"
import { Button } from "./button"

const control =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/**
 * Saved sets of Tag details, kept on this device only. If the browser blocks storage the bar
 * simply is not shown: the form works the same without it.
 */
export function PresetBar({ form, canSave, onApply }: { form: TagForm; canSave: boolean; onApply: (form: TagForm) => void }) {
  // Read once when the Tag panel first appears. The panel only exists in the browser, after photos are loaded.
  const [state, setState] = useState(() => loadPresets())
  const [selected, setSelected] = useState("")
  const [name, setName] = useState("")
  const [note, setNote] = useState<string | null>(null)

  if (!state.available) return null

  const savable = canSave && !isBlankForm(form) && name.trim() !== ""

  const commit = (presets: Preset[]) => {
    const ok = storePresets(presets)
    setNote(ok ? null : "Could not save the preset in this browser.")
    if (ok) setState({ available: true, presets })
    return ok
  }

  return (
    <section aria-label="Presets" className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="text-lg font-semibold">Presets</h3>
      <p className="text-sm text-muted-foreground">Saved on this device only. They are never sent anywhere.</p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="preset-select" className="mb-1 block font-medium">
            Preset
          </label>
          <select
            id="preset-select"
            className={control}
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value)
              const preset = state.presets.find((p) => p.id === e.target.value)
              if (preset) onApply(preset.tags)
            }}
          >
            <option value="">Choose a preset</option>
            {state.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="ghost"
          aria-disabled={selected === ""}
          onClick={() => {
            if (selected === "") return
            if (commit(state.presets.filter((p) => p.id !== selected))) setSelected("")
          }}
        >
          Delete preset
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="preset-name" className="mb-1 block font-medium">
            Preset name
          </label>
          <input id="preset-name" type="text" maxLength={60} className={control} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button
          variant="secondary"
          aria-disabled={!savable}
          onClick={() => {
            if (!savable) return
            const list = addPreset(state.presets, name, form)
            if (commit(list)) {
              setSelected(list.find((p) => p.name.toLowerCase() === name.trim().toLowerCase())?.id ?? "")
              setName("")
            }
          }}
        >
          Save preset
        </Button>
      </div>
      {note && (
        <p role="status" className="text-sm text-muted-foreground">
          {note}
        </p>
      )}
    </section>
  )
}
