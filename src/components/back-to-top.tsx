"use client"

import { ArrowUp } from "lucide-react"
import { useEffect, useRef, useState } from "react"

/**
 * The only element in the bottom-right slot. A marker sits at the very top of the page; when it
 * scrolls out of view the button appears, but only on a page taller than the window. Watching one
 * marker with an IntersectionObserver is cheap: unlike a scroll listener it does nothing while the
 * person scrolls, and speaks up only when the marker crosses the edge of the screen.
 */
export function BackToTop() {
  const marker = useRef<HTMLDivElement>(null)
  const [scrolledAway, setScrolledAway] = useState(false)
  const [tall, setTall] = useState(false)

  useEffect(() => {
    const target = marker.current
    if (!target) return
    const measure = () => setTall(document.documentElement.scrollHeight > window.innerHeight * 1.2)
    const observer = new IntersectionObserver(([entry]) => {
      measure()
      setScrolledAway(!entry.isIntersecting)
    })
    observer.observe(target)
    window.addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  return (
    <>
      {/* 300px tall, pinned to the top of the page (the body is the positioning parent) */}
      <div ref={marker} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 h-[300px] w-px" />
      {scrolledAway && tall && (
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
      )}
    </>
  )
}
