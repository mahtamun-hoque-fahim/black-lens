import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import type { PgDatabase } from "drizzle-orm/pg-core"
import * as schema from "@/db/schema"

/**
 * One owner, signed in with email and password. Nobody can create an account: the owner row is
 * inserted by hand (scripts/owner-sql.mjs), and sign-up is switched off here.
 *
 * Better Auth uses the visitor's IP address only in memory, to slow down repeated sign-in attempts.
 * The hook below makes sure the IP address and browser string are never stored in the database.
 */
export function createAuth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PgDatabase<any, any, any>,
  options: { secret: string; baseURL: string },
) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: { enabled: true, window: 60, max: 30 },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }),
        },
      },
    },
  })
}
