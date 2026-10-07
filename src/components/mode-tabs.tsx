"use client"

import { Tabs } from "radix-ui"
import type { ReactNode } from "react"

const tab =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:bg-primary/90 data-disabled:pointer-events-none data-disabled:opacity-60 motion-reduce:transition-none"

/**
 * View, Clean and Tag are three modes of one screen, not three pages (loaded files
 * live in memory and would be lost on navigation). Only Clean exists so far; the
 * others are real tabs that are switched off, not hidden, so the layout stays final.
 */
export function ModeTabs({ clean }: { clean: ReactNode }) {
  return (
    <Tabs.Root defaultValue="clean" className="space-y-6">
      <Tabs.List aria-label="Mode" className="inline-flex gap-1 rounded-xl border border-border bg-card p-1">
        <Tabs.Trigger value="view" disabled className={tab} title="Not available yet">
          View<span className="sr-only"> (not available yet)</span>
        </Tabs.Trigger>
        <Tabs.Trigger value="clean" className={tab}>
          Clean
        </Tabs.Trigger>
        <Tabs.Trigger value="tag" disabled className={tab} title="Not available yet">
          Tag<span className="sr-only"> (not available yet)</span>
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="clean" className="focus-visible:outline-hidden">
        {clean}
      </Tabs.Content>
    </Tabs.Root>
  )
}
