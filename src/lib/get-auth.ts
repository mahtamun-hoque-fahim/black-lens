import { getDb } from "@/db"
import { createAuth } from "./auth-config"

let cached: ReturnType<typeof createAuth> | null = null

/** Built on first use from the environment. Null when the database or the secrets are not set up. */
export function getAuth() {
  const secret = process.env.BETTER_AUTH_SECRET
  const baseURL = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "") // a trailing slash would break the origin check
  const db = getDb()
  if (!secret || !baseURL || !db) return null
  return (cached ??= createAuth(db, { secret, baseURL }))
}
