// @vitest-environment node
import { describe, expect, it } from "vitest"
import { isAllowedAuthRequest } from "./auth-allow"

describe("isAllowedAuthRequest", () => {
  it.each([
    ["POST", "/api/auth/sign-in/email"],
    ["POST", "/api/auth/sign-out"],
    ["GET", "/api/auth/get-session"],
  ])("allows %s %s", (method, path) => expect(isAllowedAuthRequest(method, path)).toBe(true))

  it.each([
    ["POST", "/api/auth/sign-up/email"],
    ["POST", "/api/auth/forget-password"],
    ["POST", "/api/auth/reset-password"],
    ["POST", "/api/auth/change-password"],
    ["POST", "/api/auth/change-email"],
    ["POST", "/api/auth/update-user"],
    ["POST", "/api/auth/delete-user"],
    ["GET", "/api/auth/list-sessions"],
    ["POST", "/api/auth/revoke-sessions"],
    ["GET", "/api/auth/ok"],
    ["GET", "/api/auth/sign-in/email"],
    ["GET", "/api/auth/sign-out"],
    ["POST", "/api/auth/get-session"],
    ["PUT", "/api/auth/sign-in/email"],
    ["DELETE", "/api/auth/sign-out"],
    ["POST", "/api/auth/sign-in/email/"],
    ["POST", "/api/auth/Sign-In/Email"],
    ["POST", "/api/auth/sign-in/email/extra"],
    ["POST", "/api/auth/"],
    ["POST", "/api/auth"],
    ["post", "/api/auth/sign-in/email"],
  ])("refuses %s %s", (method, path) => expect(isAllowedAuthRequest(method, path)).toBe(false))
})
