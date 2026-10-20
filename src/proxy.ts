import { NextResponse, type NextRequest } from "next/server"
import { buildCsp, makeNonce } from "@/lib/csp"

export function proxy(request: NextRequest) {
  const nonce = makeNonce()
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === "development" })

  // Always set our own values: a visitor-supplied CSP or nonce header is overwritten, never trusted.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("content-security-policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("content-security-policy", csp)
  return response
}

export const config = {
  matcher: [
    {
      // Static files carry no page to protect; prefetches are not page loads.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
