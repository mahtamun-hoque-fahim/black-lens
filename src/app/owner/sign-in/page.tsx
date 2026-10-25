import { redirect } from "next/navigation"
import { SignInForm } from "@/components/owner/sign-in-form"
import { getOwnerSession } from "@/lib/owner-session"

export const dynamic = "force-dynamic"

export default async function OwnerSignInPage() {
  if (await getOwnerSession()) redirect("/owner")
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-semibold">Owner sign-in</h1>
      <p className="mt-2 text-muted-foreground">This page is for the person who runs Black Lens.</p>
      <div className="mt-8 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card">
        <SignInForm />
      </div>
    </div>
  )
}
