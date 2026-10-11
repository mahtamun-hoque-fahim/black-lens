"use client"

import { SwitchRow } from "./switch-row"

export function IccSwitch({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (value: boolean) => void; label: string }) {
  return <SwitchRow id="remove-icc" checked={checked} onCheckedChange={onCheckedChange} label={label} hint="Off by default. Photos can look slightly different without it." />
}
