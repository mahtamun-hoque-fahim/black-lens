"use client"

import { formToInput, isBlankForm, type TagForm } from "@/lib/tag-form"
import { normalizeTags, tagLines, type TagField } from "@/lib/metadata"
import { Button } from "./button"
import { IccSwitch } from "./icc-switch"
import { PresetBar } from "./preset-bar"
import { ProgressBar } from "./progress-bar"
import { SwitchRow } from "./switch-row"

const control =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive"

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-medium">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function TagPanel({
  title,
  form,
  onChange,
  many,
  applyToAll,
  onApplyToAll,
  blocker,
  hasProfile,
  removeIcc,
  onRemoveIccChange,
  progress,
  onRun,
}: {
  /** Which photo the form is for, when each photo has its own details. */
  title: string | null
  form: TagForm
  onChange: (form: TagForm) => void
  many: boolean
  applyToAll: boolean
  onApplyToAll: (value: boolean) => void
  /** Why the button cannot be pressed yet, or null when it can. */
  blocker: string | null
  hasProfile: boolean
  removeIcc: boolean
  onRemoveIccChange: (value: boolean) => void
  progress: { done: number; total: number } | null
  onRun: () => void
}) {
  const { tags, errors } = normalizeTags(formToInput(form))
  const errorFor = (field: TagField) => errors.find((e) => e.field === field)?.message
  const set = (field: keyof TagForm) => (e: { target: { value: string } }) => onChange({ ...form, [field]: e.target.value })
  const lines = tagLines(tags)
  const running = progress !== null
  const disabled = blocker !== null || running

  return (
    <div className="space-y-6">
      {many && (
        <SwitchRow
          id="apply-all"
          checked={applyToAll}
          onCheckedChange={onApplyToAll}
          label="Apply the same details to all photos"
          hint="Turn this off to give each photo its own details. Choose a photo in the list, then fill in the form."
        />
      )}
      {title && <h2 className="text-lg font-semibold">Details for {title}</h2>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tag-artist" label="Artist" error={errorFor("artist")}>
          {(p) => <input {...p} type="text" className={control} value={form.artist} onChange={set("artist")} />}
        </Field>
        <Field id="tag-copyright" label="Copyright" error={errorFor("copyright")}>
          {(p) => <input {...p} type="text" className={control} value={form.copyright} onChange={set("copyright")} />}
        </Field>
        <Field id="tag-title" label="Title" error={errorFor("title")}>
          {(p) => <input {...p} type="text" className={control} value={form.title} onChange={set("title")} />}
        </Field>
        <Field id="tag-date" label="Date" hint="Year, month, day: 2026-01-02" error={errorFor("date")}>
          {(p) => <input {...p} type="text" inputMode="numeric" placeholder="2026-01-02" className={control} value={form.date} onChange={set("date")} />}
        </Field>
        <div className="sm:col-span-2">
          <Field id="tag-description" label="Description" error={errorFor("description")}>
            {(p) => <textarea {...p} rows={3} className={control} value={form.description} onChange={set("description")} />}
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="tag-keywords" label="Keywords" hint="Separate with commas" error={errorFor("keywords")}>
            {(p) => <input {...p} type="text" className={control} value={form.keywords} onChange={set("keywords")} />}
          </Field>
        </div>
      </div>

      <PresetBar form={form} canSave={errors.length === 0 && !isBlankForm(form)} onApply={onChange} />

      <section aria-label="What will be written" className="rounded-xl border border-border bg-background p-4">
        <h3 className="text-lg font-semibold">What will be written</h3>
        {lines.length > 0 ? (
          <dl className="mt-2">
            {lines.map((l) => (
              <div key={l.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 border-t border-border first:border-t-0 sm:grid-cols-[8rem_minmax(0,1fr)]">
                <dt className="py-2 text-muted-foreground">{l.label}</dt>
                <dd className="py-2 font-mono text-sm break-words whitespace-pre-wrap">{l.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-muted-foreground">Nothing to write yet.</p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Everything else that identifies {many && applyToAll ? "each photo" : "this photo"} is removed first. Only the details above are written.
        </p>
      </section>

      {hasProfile && <IccSwitch checked={removeIcc} onCheckedChange={onRemoveIccChange} label="Also remove the colour profile" />}

      {running && <ProgressBar done={progress.done} total={progress.total} label="Tagging progress" />}

      <div className="space-y-2">
        <Button aria-disabled={disabled} onClick={() => !disabled && onRun()}>
          {running ? "Working" : "Clean, tag, and download"}
        </Button>
        {blocker && <p className="text-sm text-muted-foreground">{blocker}</p>}
      </div>
    </div>
  )
}
