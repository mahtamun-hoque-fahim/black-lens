import { cn } from "@/lib/utils"
import type { Chip } from "./batch-item"

/** Words only, never colour alone. "Has location" is the one chip that uses the destructive tokens. */
export function StatusChip({ chip }: { chip: Chip }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-sm font-medium",
        chip.tone === "location" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      {chip.text}
    </span>
  )
}
