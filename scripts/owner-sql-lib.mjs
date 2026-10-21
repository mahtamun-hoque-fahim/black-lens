// Pure helpers for scripts/owner-sql.mjs. No I/O here, so they can be tested.

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/
const SAFE_ID = /^[A-Za-z0-9_-]{8,64}$/
// Better Auth writes password hashes as "<salt hex>:<key hex>".
const SAFE_HASH = /^[0-9a-f]{16,128}:[0-9a-f]{64,256}$/

export function isValidEmail(email) {
  return typeof email === "string" && email.length <= 254 && EMAIL.test(email)
}

export function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 12) return "Use at least 12 characters."
  if (password.trim().length === 0) return "A password of only spaces is not allowed."
  return null
}

/** SQL to paste into the Neon SQL Editor: the single owner user and its sign-in. */
export function buildOwnerSql({ id, email, hash }) {
  if (!isValidEmail(email)) throw new Error("Invalid email")
  if (!SAFE_ID.test(id)) throw new Error("Invalid id")
  if (!SAFE_HASH.test(hash)) throw new Error("Invalid password hash")
  const e = email.toLowerCase()
  // Every value is checked against a strict pattern above, so none can contain a quote.
  return `BEGIN;
INSERT INTO "user" ("id", "name", "email", "email_verified")
VALUES ('${id}', 'Owner', '${e}', true);
INSERT INTO "account" ("id", "account_id", "provider_id", "user_id", "password")
VALUES ('${id}-credential', '${id}', 'credential', '${id}', '${hash}');
COMMIT;
`
}
