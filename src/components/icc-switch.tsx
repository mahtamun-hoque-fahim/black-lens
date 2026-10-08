"use client"

import { Switch } from "radix-ui"

export function IccSwitch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean
  onCheckedChange: (value: boolean) => void
  label: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch.Root
        id="remove-icc"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby="remove-icc-hint"
        className="mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-lg border border-input bg-secondary p-0.5 transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:bg-foreground motion-reduce:transition-none"
      >
        <Switch.Thumb className="block size-4.5 rounded-md bg-foreground transition-transform duration-150 data-[state=checked]:translate-x-5 data-[state=checked]:bg-background motion-reduce:transition-none" />
      </Switch.Root>
      <div>
        <label htmlFor="remove-icc" className="font-medium">
          {label}
        </label>
        <p id="remove-icc-hint" className="text-sm text-muted-foreground">
          Off by default. Photos can look slightly different without it.
        </p>
      </div>
    </div>
  )
}
