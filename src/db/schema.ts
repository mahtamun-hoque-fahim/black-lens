import { sql } from "drizzle-orm"
import { boolean, check, date, index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

/**
 * The four tables Better Auth needs for one owner login (emailAndPassword only).
 * The session table has ip_address and user_agent columns because Better Auth defines them;
 * src/lib/auth-config.ts makes sure they are always written as NULL.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
)

/**
 * The only usage data Black Lens keeps: how many photos were processed, per UTC day and mode.
 * No file names, no file contents, no IP address, no visitor id.
 */
export const COUNT_MODES = ["view", "clean", "tag"] as const
export type CountMode = (typeof COUNT_MODES)[number]

export const dailyCounts = pgTable(
  "daily_counts",
  {
    day: date("day").notNull(),
    mode: text("mode").notNull(),
    count: integer("count").default(0).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.day, t.mode] }),
    check("daily_counts_mode_check", sql`${t.mode} in ('view', 'clean', 'tag')`),
    check("daily_counts_count_check", sql`${t.count} >= 0`),
  ],
)
