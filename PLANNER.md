# Black Lens — Planner

> A free, in-browser tool that shows the hidden metadata inside photos, removes the identifying parts, and optionally writes the owner's own author and copyright details. Photos never leave the device.

## Project Overview

**Purpose.** Photos carry GPS location, camera serial numbers, timestamps and editing history, and people publish them without knowing. Black Lens shows what a file carries, removes everything identifying, and can write the user's own Artist, Copyright, Description and similar fields. It runs entirely in the browser: no uploads, no account.

**Target user.** Fahim first (a photographer and designer who strips location from his own photos and stamps copyright on published work), then anyone who wants the same without trusting an upload server. It is also a showcase piece with its own URL and identity.

**Key value.** A privacy claim that can be checked: clean a photo, re-scan it, see what was removed and what was kept.

**Current phase.** Building (foundation done, Clean on JPEG is next).

---

## Architecture

**Stack:** (from BRAIN.md § Stack)
- Framework: Next.js 16 App Router, TypeScript (strict), Tailwind CSS v4, shadcn/ui
- Content: TypeScript files in `src/content`
- Database: Neon PostgreSQL + Drizzle, for the owner dashboard counters only
- Auth: Better Auth, one owner, signups disabled
- Deployment: Vercel only (no Cloudflare, no OpenNext)

**Core design rule.** Reading, stripping and writing metadata live in pure functions with no DOM dependency, so the same core can later power a local CLI and a local MCP server. The web UI is a thin layer over it.

**What Clean removes and keeps (locked).** Removes everything identifying the person, device, place, time or software. Keeps the EXIF Orientation flag, the colour profile (ICC), and structural data the format needs to render. A "remove colour profile too" switch is off by default. The result screen lists what was kept. The per-format segment map (JPEG segments, PNG chunks, WebP chunks) is written before the strip code.

**Deployment topology:**
- `main` → Vercel production
- PRs → Vercel preview

**Folder structure (summary):** see README.md.

---

## User Flows

### Flow 1: Clean one photo
1. User lands on `/` and drops a photo (or picks files, a folder, or a ZIP)
2. The tool reads the file in the browser and shows a short summary of what it found, with a clear warning if GPS is present
3. User keeps Clean selected and presses "Clean and download"
4. The tool strips identifying metadata without re-encoding, then re-reads its own output to verify
5. The result screen lists what was removed and what was kept (Orientation, colour profile) and offers the download

### Flow 2: Inspect only (View)
1. User switches to View after loading files
2. Per file: grouped read-only list (Location, Camera, Dates, Software, Author), each value copyable
3. User can copy a value or the full list, then switch to Clean

### Flow 3: Clean and tag (Tag)
1. User switches to Tag and fills Artist, Copyright, Title, Description, Keywords, Date
2. Optional: apply a saved preset (stored on this device only) or save a new one; toggle "apply to all"
3. A plain "what will be written" list previews the result
4. "Clean, tag, and download" strips first, then writes only the chosen fields

### Flow 4: Owner checks usage
1. Owner opens `/owner/sign-in` and signs in (signups are disabled)
2. `/owner` shows aggregate counts only: runs per day, mode split, format split, file-count buckets
3. No filenames, metadata or per-user data exist to show

---

## DB Schema

Neon + Drizzle. Used only for the owner dashboard. Proposed, to be confirmed in the dashboard phase. Schema lives in `src/lib/db/schema.ts`.

### Better Auth tables
`user`, `session`, `account`, `verification`: standard Better Auth tables. One owner row, created by a seed script.

### usage_daily
| column | type | notes |
|---|---|---|
| id | serial PK | |
| day | date | UTC day, no time of day |
| mode | enum | view / clean / tag |
| fileBucket | enum | 1 / 2-5 / 6-20 / 21-50 / 50+ |
| runs | integer | incremented by upsert |

Unique on (day, mode, fileBucket).

### usage_format_daily
| column | type | notes |
|---|---|---|
| id | serial PK | |
| day | date | |
| format | enum | jpeg / png / webp |
| files | integer | incremented by upsert |

Unique on (day, format). No per-run rows, no timestamps finer than a day, no IPs, no filenames.

---

## API Routes

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | /api/counter | public (validated, rate-limited) | `{ mode, fileBucket, formats }` (enums only) | `{ ok: true }` |
| ALL | /api/auth/[...all] | Better Auth | per Better Auth | per Better Auth |

`/api/counter` accepts enum values only and rejects anything else. Sign-up is disabled on the server, not just hidden in the UI.

---

## Env Vars

Only the variables the code reads. Every row is also in `.env.example`.

| Name | Required | Description | Example |
|---|---|---|---|
| NEXT_PUBLIC_SITE_URL | yes | Production URL: canonical links, sitemap, OG images | https://black-lens.vercel.app |
| DATABASE_URL | yes (dashboard phase) | Neon pooled connection | postgresql://...?sslmode=require |
| DATABASE_URL_UNPOOLED | yes (dashboard phase) | Neon direct connection (migrations) | postgresql://...?sslmode=require |
| BETTER_AUTH_SECRET | yes (dashboard phase) | Session signing secret (32+ chars) | (openssl rand -base64 32) |
| BETTER_AUTH_URL | yes (dashboard phase) | Public app URL | https://black-lens.vercel.app |
| OWNER_EMAIL | seed script only | Email for the single owner account | |
| OWNER_PASSWORD | seed script only | Password for the single owner account; remove after seeding | |

---

## Timeline / Phases

Build in vertical slices (Council PRE-BUILD, requirement 3). Tests before code, with fixtures.

### Phase 1: Foundation
Status: `[~]` in progress

- [x] Scaffold (create-next-app, Vitest, Testing Library, jsx-a11y), git identity, Session Start block
- [x] BRAIN.md, SITETREE.md, COUNCIL.md, visual identity locked
- [x] PLANNER.md, DESIGN_GUIDE.md, README.md, AGENTS.md
- [ ] Run `shadcn init` locally (the sandbox cannot reach ui.shadcn.com) and commit
- [ ] Write the locked palette and fonts into `globals.css`; connect the repo to Vercel

### Phase 2: Spec and fixtures
Status: `[ ]` pending

- [ ] Per-format segment map (what is removed, what is kept) written down
- [ ] Fixture images per format with known metadata
- [ ] Tests that fail first: reader, stripper, re-read check, pixel data unchanged

### Phase 3: Clean on JPEG, end to end
Status: `[ ]` pending

- [ ] Pure core: JPEG reader and stripper (Orientation and ICC kept)
- [ ] App shell: header, theme toggle, home, drop zone, mode tabs
- [ ] Single-file Clean with result summary and verified re-scan

### Phase 4: PNG, WebP, batches
Status: `[ ]` pending

- [ ] PNG and WebP strippers
- [ ] Multiple files, folder, ZIP input and ZIP output; count and size limits
- [ ] "Not supported yet" handling (HEIC and others)

### Phase 5: View
Status: `[ ]` pending

- [ ] Grouped inspector, GPS warning panel (destructive tokens), copy to clipboard

### Phase 6: Tag
Status: `[ ]` pending

- [ ] Writers for the chosen fields per format, device-only presets, apply to all

### Phase 7: Owner dashboard (gate for the public showcase)
Status: `[ ]` pending

- [ ] Neon, Drizzle schema, Better Auth with signups disabled, owner seed script
- [ ] Counter endpoint (validated, rate-limited, no IPs), CSP locked to `connect-src 'self'`
- [ ] `/owner` and `/owner/sign-in`; privacy page names the counters and what Vercel logs

### Phase 8: Polish and launch checks
Status: `[ ]` pending

- [ ] Back to top, accessibility pass (WCAG 2.2 AA), test on real phones
- [ ] `/privacy`, `/terms`, 404, print stylesheet
- [ ] compass post-build sequence

### Phase 9: CLI and local MCP server
Status: `[ ]` pending

- [ ] Thin wrappers over the same core; MCP runs locally only

---

## Next Steps

In order:
1. Run `npx shadcn@latest init --base radix --preset nova -y` locally, commit, then write the locked tokens into `globals.css`
2. Write the per-format segment map (JPEG first) and the fixtures
3. Write the first failing tests for the JPEG reader and stripper, then implement

---

## Notes & decisions

**2026-10-05.** Modes (View, Clean, Tag) are UI state on `/`, not separate routes, because loaded files live in memory.
**2026-10-05.** Clean keeps Orientation and the colour profile; the claim is "all identifying metadata removed", never "zero tags".
**2026-10-05.** Analytics is an owner-only dashboard with aggregate counts (Neon + Drizzle + Better Auth) instead of a third-party tool.
