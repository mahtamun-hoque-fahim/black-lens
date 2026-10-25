/**
 * Better Auth ships with many endpoints (sign-up, password reset, account changes, session lists).
 * Black Lens has one owner and needs three of them. Everything else is closed here, so even a
 * future configuration mistake cannot open a door nobody meant to open.
 */
const ALLOWED = new Set(["POST /api/auth/sign-in/email", "POST /api/auth/sign-out", "GET /api/auth/get-session"])

export function isAllowedAuthRequest(method: string, pathname: string): boolean {
  return ALLOWED.has(`${method} ${pathname}`)
}
