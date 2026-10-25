import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

/** Opened on first use, so the build and the tests never need a database. Null when none is configured. */
export function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) return null
  return drizzle(neon(url), { schema })
}
