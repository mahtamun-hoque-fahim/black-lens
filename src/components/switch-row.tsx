"use client"

import { Switch } from "radix-ui"

/** A labelled on/off switch with a line of help. The label is what a screen reader announces. */
export function SwitchRow({
  id,
  checked,
  onCheckedChange,
  label,
  hint,
}: {
  id: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
  label: string
  hint: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby={`${id}-hint`}
        className="mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-lg border border-input bg-secondary p-0.5 transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:bg-foreground motion-reduce:transition-none"
      >
        <Switch.Thumb className="block size-4.5 rounded-md bg-foreground transition-transform duration-150 data-[state=checked]:translate-x-5 data-[state=checked]:bg-background motion-reduce:transition-none" />
      </Switch.Root>
      <div>
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      </div>
    </div>
  )
}
