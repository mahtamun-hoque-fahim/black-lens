import type { Metadata } from "next"

// The owner pages are not linked from anywhere and must never show up in search results.
export const metadata: Metadata = {
  title: "Owner",
  robots: { index: false, follow: false },
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return children
}
