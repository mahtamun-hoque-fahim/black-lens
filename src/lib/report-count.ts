import type { CountMode } from "@/db/schema"
import { MAX_PER_CALL } from "./count-rules"

/**
 * Tells the site's own counter that `n` photos were processed in a mode. Only the mode and the number
 * are sent: no file names, no photo data, no cookies, no referrer. It never throws and never waits for
 * the person: if the counter is down or blocked, nothing visible happens.
 */
export async function reportCount(mode: CountMode, n: number): Promise<void> {
  if (!Number.isInteger(n) || n < 1 || typeof fetch !== "function") return
  for (let left = n; left > 0; left -= MAX_PER_CALL) {
    try {
      await fetch("/api/count", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, n: Math.min(left, MAX_PER_CALL) }),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
      })
    } catch {
      return
    }
  }
}
