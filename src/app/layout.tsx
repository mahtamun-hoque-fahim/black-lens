import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { BackToTop } from "@/components/back-to-top"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: {
    default: "Black Lens",
    template: "%s | Black Lens",
  },
  description: "Remove hidden metadata from photos in your browser. Nothing is uploaded.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes adds the theme class to <html> before React loads
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:border focus:border-border focus:bg-card focus:px-4 focus:py-2 focus:font-medium focus:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            Skip to main content
          </a>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex-1 outline-hidden">
            {children}
          </main>
          <SiteFooter />
          <BackToTop />
        </ThemeProvider>
      </body>
    </html>
  )
}
