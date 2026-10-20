/**
 * Content Security Policy for every page.
 *
 * The browser enforces this list: scripts run only if they come from this site or carry this
 * request's nonce, and nothing on the page can send data to any other site. The nonce is a
 * fresh random value per request, so an attacker cannot guess it.
 */

const NONCE_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/

/** 128 bits from the platform's secure random source, as base64. */
export function makeNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export function buildCsp({ nonce, isDev }: { nonce: string; isDev: boolean }): string {
  // A nonce is pasted into a header, so refuse anything that could add a directive.
  if (!NONCE_PATTERN.test(nonce)) throw new Error("Invalid CSP nonce")

  const directives: string[] = [
    "default-src 'self'",
    // 'strict-dynamic' trusts scripts that a nonced script loads, which is how Next.js loads its chunks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // Radix writes a few style attributes into the page HTML (tab list, tab panel). An attribute cannot run
    // script, and every route out of the page is closed by the directives below, so this stays narrow.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
  // Forcing https would break http://localhost in development.
  if (!isDev) directives.push("upgrade-insecure-requests")
  return directives.join("; ")
}

export function nonceFromCsp(csp: string | null): string | null {
  const match = csp?.match(/'nonce-([A-Za-z0-9+/]+={0,2})'/)
  return match ? match[1] : null
}
