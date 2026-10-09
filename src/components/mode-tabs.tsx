"use client"

import { Tabs } from "radix-ui"
import type { ReactNode } from "react"

export type Mode = "view" | "clean"

const tab =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:bg-primary/90 data-disabled:pointer-events-none data-disabled:opacity-60 motion-reduce:transition-none"

/**
 * View, Clean and Tag are three modes of one screen, not three pages: the photos you load live in
 * memory and would be lost on navigation. The mode is owned by the Workspace so every mode shares
 * the same photos. Tag is a real tab that is switched off until it is built, so the layout stays final.
 */
export function ModeTabs({ mode, onModeChange, view, clean }: { mode: Mode; onModeChange: (mode: Mode) => void; view: ReactNode; clean: ReactNode }) {
  return (
    <Tabs.Root value={mode} onValueChange={(value) => onModeChange(value as Mode)} className="space-y-6">
      <Tabs.List aria-label="Mode" className="inline-flex gap-1 rounded-xl border border-border bg-card p-1">
        <Tabs.Trigger value="view" className={tab}>
          View
        </Tabs.Trigger>
        <Tabs.Trigger value="clean" className={tab}>
          Clean
        </Tabs.Trigger>
        <Tabs.Trigger value="tag" disabled className={tab} title="Not available yet">
          Tag<span className="sr-only"> (not available yet)</span>
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="view" className="focus-visible:outline-hidden">
        {view}
      </Tabs.Content>
      <Tabs.Content value="clean" className="focus-visible:outline-hidden">
        {clean}
      </Tabs.Content>
    </Tabs.Root>
  )
}
