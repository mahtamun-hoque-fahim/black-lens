"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ReactNode } from "react"

/**
 * Follows the device until the person chooses. next-themes sets the `.dark` class
 * before React hydrates, which is what prevents a flash of the wrong theme. That small inline
 * script carries the request's CSP nonce, or the browser would refuse to run it.
 */
export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      {children}
    </NextThemesProvider>
  )
}
