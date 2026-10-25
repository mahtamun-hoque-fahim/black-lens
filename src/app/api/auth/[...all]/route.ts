import { toNextJsHandler } from "better-auth/next-js"
import { isAllowedAuthRequest } from "@/lib/auth-allow"
import { getAuth } from "@/lib/get-auth"
import { isSameOrigin } from "@/lib/same-origin"

export const dynamic = "force-dynamic"

async function handle(method: "GET" | "POST", request: Request) {
  if (!isAllowedAuthRequest(request.method, new URL(request.url).pathname)) return new Response(null, { status: 404 })
  // Better Auth only checks the Origin of requests that already carry a cookie, so a sign-in made by another
  // site would pass. Every POST must come from this site's own pages.
  if (method === "POST" && !isSameOrigin(request.headers)) return new Response(null, { status: 403 })
  const auth = getAuth()
  if (!auth) return new Response(null, { status: 503 })
  return toNextJsHandler(auth)[method](request)
}

export const GET = (request: Request) => handle("GET", request)
export const POST = (request: Request) => handle("POST", request)
