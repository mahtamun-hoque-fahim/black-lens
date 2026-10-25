"use client"

import { useRouter } from "next/navigation"
import { Button } from "../button"

export function SignOutButton() {
  const router = useRouter()
  async function signOut() {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        credentials: "same-origin",
      })
    } catch {
      // Even if the call fails, leave the dashboard: the page checks the session again on every load.
    }
    router.replace("/owner/sign-in")
    router.refresh()
  }
  return (
    <Button variant="secondary" onClick={signOut}>
      Sign out
    </Button>
  )
}
