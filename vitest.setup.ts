import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => cleanup())

// The metadata core runs in the plain node environment (it has no DOM dependency),
// so only touch window when jsdom provides one.
if (typeof window !== "undefined") {
  // jsdom has no matchMedia; components that read prefers-reduced-motion need it
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
