import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-border print:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
        <p>Photos never leave your device.</p>
        <Link
          href="/privacy"
          className="inline-flex min-h-11 items-center rounded-lg font-medium underline underline-offset-4 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          Privacy
        </Link>
      </div>
    </footer>
  )
}
