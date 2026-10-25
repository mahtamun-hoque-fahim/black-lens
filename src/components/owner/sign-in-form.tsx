"use client"

import { useRouter } from "next/navigation"
import { useId, useState, type FormEvent } from "react"
import { Button } from "../button"

const FIELD =
  "block min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"

function messageFor(status: number): string {
  if (status === 401 || status === 403) return "That email and password do not match."
  if (status === 429) return "Too many attempts. Wait a minute and try again."
  return "Sign-in is not available right now."
}

export function SignInForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const errorId = useId()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    const email = String(data.get("email") ?? "").trim()
    const password = String(data.get("password") ?? "")
    if (!email || !password) {
      setError("Enter your email and password.")
      return
    }
    setError(null)
    setPending(true)
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
      })
      if (res.ok) {
        router.replace("/owner")
        router.refresh()
        return
      }
      setError(messageFor(res.status))
    } catch {
      setError(messageFor(0))
    }
    setPending(false)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="owner-email" className="block text-sm font-medium">
          Email
        </label>
        <input id="owner-email" name="email" type="email" autoComplete="username" className={FIELD} aria-describedby={error ? errorId : undefined} />
      </div>
      <div className="space-y-2">
        <label htmlFor="owner-password" className="block text-sm font-medium">
          Password
        </label>
        <input id="owner-password" name="password" type="password" autoComplete="current-password" className={FIELD} aria-describedby={error ? errorId : undefined} />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" aria-disabled={pending} className="w-full">
        {pending ? "Signing in" : "Sign in"}
      </Button>
    </form>
  )
}
