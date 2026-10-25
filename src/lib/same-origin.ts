/**
 * True when a request was made by a page of this same site. It stops other websites from
 * making a visitor's browser call the counter. It is not a login: a script that sets its own
 * Origin header gets past it, which is why the counter also has a per-call maximum and a daily cap.
 */
export function isSameOrigin(headers: Headers): boolean {
  const host = headers.get("host")
  const origin = headers.get("origin")
  if (!host || !origin) return false
  const site = headers.get("sec-fetch-site")
  if (site !== null && site !== "same-origin") return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
