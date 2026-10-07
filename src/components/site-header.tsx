import { Aperture } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "./theme-toggle"

export function SiteHeader() {
  return (
    <header className="border-b border-border print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg font-heading text-lg font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Aperture aria-hidden="true" className="size-6" />
          Black Lens
        </Link>
        <ThemeToggle />
      </div>
    </header>
  )
}
