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
Status: `[~]` in progress (only the Vercel connection is left)

- [x] Scaffold (create-next-app, Vitest, Testing Library, jsx-a11y), git identity, Session Start block
- [x] BRAIN.md, SITETREE.md, COUNCIL.md, visual identity locked
- [x] PLANNER.md, DESIGN_GUIDE.md, README.md, AGENTS.md
- [x] Run `shadcn init` locally and commit
- [x] Write the locked palette and fonts into `globals.css`
- [ ] Connect the repo to Vercel (owner task)

### Phase 2: Spec and fixtures
Status: `[x]` JPEG, PNG and WebP maps and fixtures done

- [x] JPEG segment map (`docs/formats/jpeg.md`)
- [x] JPEG fixtures (8, generated by `scripts/make-fixtures.py`)
- [x] Tests that failed first: reader, stripper, re-read check, pixel data unchanged
- [x] PNG chunk map (`docs/formats/png.md`) and 9 fixtures
- [x] WebP chunk map (`docs/formats/webp.md`) and 10 fixtures

### Phase 3: Clean on JPEG, end to end
Status: `[x]` built; waiting on Fahim's visual review (no browser in the build sandbox)

- [x] Pure core: JPEG reader, stripper and verifier (Orientation and ICC kept), `stripMetadata()` entry point, `summarizeMetadata()`
- [x] App shell: skip link, header, theme toggle, home, footer, back to top, 404, mode tabs (View and Tag shown but switched off)
- [x] Single-file Clean: drop zone, what-it-carries summary with location warning, colour profile switch, result screen (removed, kept, verified re-scan), download

### Phase 4: PNG, WebP, batches
Status: `[x]` built; waiting on Fahim's review on real photos

- [x] PNG stripper, verifier and summary (75 tests; checked with exiftool, Pillow and six planted bugs)
- [x] WebP stripper, verifier and summary (95 tests; checked with exiftool, Pillow and eight planted bugs)
- [x] Multiple files, folders (picker and drag-drop), ZIP input and ZIP output, queue with inspector, progress, count and size limits (200 photos, 100 MB each, 500 MB total), Web Worker with main-thread fallback (356 tests; ZIP checked with Python zipfile and unzip)
- [x] "Not supported" handling (HEIC and others): word-only chip in the queue, plain sentence in the inspector

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
1. Fahim reviews the live page with real photos: one photo, a batch, a folder, a ZIP; light and dark; phone width
2. Phase 5: View mode (grouped inspector: Location, Camera, Dates, Software, Author; copyable values; GPS warning)
3. Phase 6: Tag mode (author and copyright writers per format)

---

## Notes & decisions

**2026-10-05.** Modes (View, Clean, Tag) are UI state on `/`, not separate routes, because loaded files live in memory.
**2026-10-05.** Clean keeps Orientation and the colour profile; the claim is "all identifying metadata removed", never "zero tags".
**2026-10-05.** Analytics is an owner-only dashboard with aggregate counts (Neon + Drizzle + Better Auth) instead of a third-party tool.
**2026-10-05.** Clean fails closed: `stripMetadata()` re-reads its own output and compares the image data to the input; if either check fails it throws and returns no file.
**2026-10-05.** Default deny: only segments on the allow-list in `docs/formats/jpeg.md` are copied; unknown segments are removed. MPF and trailing data are removed, so Ultra HDR and gain maps are dropped and the photo shows in standard range.
**2026-10-05.** Drop zone copy named only the formats that worked at the time. It now says "JPEG, PNG and WebP" because all three work.
**2026-10-05.** Theme toggle uses next-themes (system by default, class on html). Its inline script will need a nonce or hash when the CSP is added in Phase 7.
**2026-10-05.** PNG: `pHYs` (pixel density) is kept as a display hint, not identifying; an unknown critical chunk makes the file rejected as corrupt instead of guessed at; text chunks are removed, including legacy `Raw profile type exif`, so Orientation stored that way is not carried over (modern `eXIf` is).
**2026-10-05.** WebP: the RIFF size is rewritten after stripping; VP8X flags are rebuilt to match the chunks really present (ICC, EXIF, alpha, animation) and reserved bits and bytes are cleared; unknown chunks inside animation frames are removed; pad bytes after odd-sized chunks are zeroed because padding is a place to hide data. EXIF goes last, after the image data, as the layout requires.
**2026-10-05.** Batch limits (a product decision, `src/lib/limits.ts`): 200 photos, 100 MB each, 500 MB total, so a phone browser can hold originals and cleaned copies at once. A photo over the size limit stays in the queue as a "Too big" row; photos past the count or total limit are left out with one notice.
**2026-10-05.** ZIP output stores files (no deflate, photos are already compressed), uses a fixed 1980-01-01 timestamp so the archive does not record when the person cleaned their photos, and records no Unix owner or permission bits. ZIP input reads stored and deflated files, rejects encrypted and ZIP64, and refuses zip bombs by declared size before inflating. See `docs/formats/zip.md`.
**2026-10-05.** Work runs in a Web Worker (`src/lib/clean.worker.ts`); if the worker cannot start or breaks, the same function (`processRequest`) runs on the main thread, so the page never dies for lack of a worker.
**2026-10-05.** Not built on purpose: adding more photos to an existing queue (a new drop replaces it), a cancel button during a batch, per-photo downloads from the batch result. Candidates for a later polish pass.
**2026-10-09.** License: MIT, copyright 2026 Mahtamun Hoque Fahim (the legal name, not the brand). Public repo, open tool.
**2026-10-09.** Versioning: semantic, below 1.0.0 until the public showcase. v0.1.0 (released: Clean, batches, ZIP) then v0.2.0 View mode, v0.3.0 Tag mode, v0.4.0 owner dashboard and CSP, v1.0.0 after polish, accessibility and the privacy pages. Fixes between are patch releases. 0.x releases are marked as GitHub pre-releases. The CLI and MCP get their own versions later. The v0.1.0 tag was cut before Council POST, a deliberate exception because the site was already public; the LICENSE file landed after the tag and ships in the next release.
