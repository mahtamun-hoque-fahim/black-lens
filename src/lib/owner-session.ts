import { headers } from "next/headers"
import { getAuth } from "./get-auth"

/** The signed-in owner's session, or null for everyone else, including when auth is not set up. */
export async function getOwnerSession() {
  const auth = getAuth()
  if (!auth) return null
  try {
    return await auth.api.getSession({ headers: await headers() })
  } catch {
    return null
  }
}
