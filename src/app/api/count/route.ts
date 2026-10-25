import { getDb } from "@/db"
import { parseCountBody, utcDay } from "@/lib/count-rules"
import { recordCount } from "@/lib/counter"
import { isSameOrigin } from "@/lib/same-origin"

export const dynamic = "force-dynamic"

/** A real report is about 25 bytes. Anything much bigger is not one. */
const MAX_BODY_BYTES = 256

// Every answer carries no body and no cookie, and says nothing about why a call failed.
const reply = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } })

/**
 * Adds to the daily count of photos processed in a mode. Receives only `{ mode, n }`.
 * It does not read, store or log the visitor's IP address, and sets no cookie.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return reply(403)
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply(415)

  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > MAX_BODY_BYTES) return reply(413)
  const text = await request.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return reply(413)

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return reply(400)
  }
  const parsed = parseCountBody(body)
  if (!parsed.ok) return reply(400)

  const db = getDb()
  if (!db) return reply(503)
  try {
    const counted = await recordCount(db, { mode: parsed.mode, n: parsed.n, day: utcDay(new Date()) })
    return reply(counted ? 204 : 429)
  } catch {
    return reply(503)
  }
}
