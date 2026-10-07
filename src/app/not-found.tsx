import Link from "next/link"

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold">This page does not exist</h1>
      <p className="mt-4 text-lg text-muted-foreground">The link may be wrong, or the page may have moved.</p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
      >
        Go to the home page
      </Link>
    </div>
  )
}
