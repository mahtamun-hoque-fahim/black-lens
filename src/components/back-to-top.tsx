"use client"

import { ArrowUp } from "lucide-react"
import { useEffect, useState } from "react"

/**
 * The only element in the bottom-right slot. Shows only when the page is taller than
 * the window and the person has scrolled down. 44px target, clear of the iPhone home bar.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const update = () => {
      const taller = document.documentElement.scrollHeight > window.innerHeight * 1.2
      setVisible(taller && window.scrollY > 300)
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
      }}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 inline-flex size-11 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors duration-150 hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none print:hidden"
    >
      <ArrowUp aria-hidden="true" className="size-5" />
      <span className="sr-only">Back to top</span>
    </button>
  )
}
