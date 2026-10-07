<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Black Lens

A free, in-browser tool that shows the hidden metadata inside photos, removes the identifying parts, and optionally writes the owner's own author and copyright details. Photos never leave the device.

## Current State

(Rewritten at the end of every session with substantive work. Everything here is true today; anything older lives in the Session Log.)

- Updated: 2026-10-05
- Status: Phase 4 in progress: JPEG and PNG clean end to end; WebP not started
- Works: metadata core for JPEG and PNG (`src/lib/metadata/`: sniffer, per-format parser, shared EXIF reader, stripper, verifier, `stripMetadata()`, `summarizeMetadata()`, CRC-32); UI in `src/components/` (Workspace, drop zone, file card, result screen, mode tabs, theme toggle); 190 passing tests; segment maps in `docs/formats/jpeg.md` and `docs/formats/png.md`; 17 fixtures
- In progress: nothing half-built
- Next: WebP slice (chunk map in `docs/formats/webp.md` first, then fixtures, failing tests, stripper), then batches and ZIP, then restore the "JPEG, PNG or WebP" drop zone wording
- Watch out: no browser exists in the build sandbox, so layout and colours were never seen by Claude; `next build` needs network for `next/font/google` (fine on Vercel); `npx tsc --noEmit` needs `npm run typegen` first; the sRGB profile Pillow builds embeds its creation time, so re-running `scripts/make-fixtures.py` rewrites phone-gps.jpg and png-metadata.png (run it only to add a fixture, then `git checkout` the rest); View and Tag tabs are disabled on purpose until their phases; WebP and HEIC throw "not supported yet"; the next-themes inline script needs a nonce or hash when the CSP lands in Phase 7; `src/components/button.tsx` sits outside `components/ui` so `shadcn add` cannot overwrite it; `npm audit` reports 9 high findings, all in dev tooling, never run `audit fix --force`; a classic GitHub token is used per command for pushes and must be revoked when the work is done

## Git Identity (Session Start - run before any commit, every session)

```
git config user.name "mahtamun-hoque-fahim"
git config user.email "mahtamunhoquefahim@gmail.com"
```

Execute automatically at the start of every session, before the first commit. Never ask, never skip, never commit as Claude. This applies across every Claude account and session working this repo.

## Setup & Commands

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Type check: `npm run typegen` then `npx tsc --noEmit`
- Lint: `npx eslint .`
- Tests: `npm test` (Vitest). Core tests use `// @vitest-environment node`; the core has no DOM dependency
- Regenerate JPEG fixtures: `python scripts/make-fixtures.py` (needs `pip install pillow piexif`)
- DB push (dev only): `npx drizzle-kit push` (dashboard phase)
- DB migrate (production): `npx drizzle-kit generate` then `npx drizzle-kit migrate` (dashboard phase)

## Conventions & Non-Negotiables

- No emojis anywhere in code or UI: lucide-react icons or inline SVG only
- Tests first. Fixtures per format with known metadata; every strip is verified by re-reading the output and by comparing the image data
- The metadata core (read, strip, write) is pure functions with no DOM dependency, so a CLI and a local MCP server can reuse it
- Clean removes everything identifying and keeps the EXIF Orientation flag, the colour profile (ICC) and structural data the format needs. Copy says "all identifying metadata removed", never "zero tags"
- View, Clean and Tag are UI state on `/`, not separate routes
- The palette, fonts and radii are locked in BRAIN.md; read tokens from `globals.css`, never hard-code hex. Brand red only for the primary button, active tab, focus and progress; the GPS warning uses the destructive tokens
- Plain human wording in the UI; see DESIGN_GUIDE.md, Copy rules
- Vercel only: no Cloudflare, no OpenNext
- Fonts load through `next/font`; no runtime requests to third-party hosts
- `src/components/ui/` is shadcn code: `npx shadcn add` overwrites it, so record every hand edit there under Watch out
- Better Auth (dashboard phase): one owner, sign-up disabled on the server, session checked server-side via `auth.api.getSession()`, never client-only

## Security Gotchas

- `.env.local` is never committed. If a secret leaks into git history or chat, rotate it immediately, do not just remove it going forward
- Never put a personal access token in a file, a remote URL or `.git/config`. Pass it per command and revoke it when the work is done
- `/api/counter` accepts enum values only, is rate-limited, and stores no IPs, filenames or metadata. Counts only
- CSP uses `connect-src 'self'`; no third-party scripts or fonts at runtime
- `OWNER_EMAIL` and `OWNER_PASSWORD` are for the one-time seed script only; remove them afterwards

## Session Log

(Newest first: add each new entry at the top. No cap: never delete or shorten older entries. When a later session reverses a decision, mark the old line `[SUPERSEDED YYYY-MM-DD]`. This section updates automatically at the end of any session with substantive work, independent of whether "update repo" was said.)

### 2026-10-05 (session 4: PNG)
- Did: Pushed Phase 3 after the first token was revoked. Wrote the PNG chunk map, 9 PNG fixtures and failing tests, then CRC-32, parser, inspector, stripper and verifier. Shared the EXIF reader and result types between formats. Wired PNG into `stripMetadata` and `summarizeMetadata`, and made download name and MIME follow the format. Verified with exiftool, Pillow (pixels, all APNG frames, CRCs), a raw secret grep and six planted bugs
- Decided: `pHYs` kept; unknown critical chunk rejected as corrupt; legacy `Raw profile type exif` text not carried over; drop zone says "JPEG and PNG" until WebP lands
- Next: WebP slice

### 2026-10-05 (session 3: Phase 3 UI)
- Did: Confirmed Vercel was connected and deployed. Added `summarizeMetadata()` (tests first). Built the app shell and the whole Clean flow with 8 behaviour tests for the Workspace. Checked the server HTML and the 404 by running the dev server
- Decided: next-themes for the theme; Radix Tabs and Switch for keyboard and ARIA behaviour; View and Tag tabs visible but disabled; one photo at a time until Phase 4; "Already clean" photos get no Clean button
- Next: visual review by Fahim, then Phase 4 (PNG first)

### 2026-10-05 (session 2: JPEG core)
- Did: Reviewed the repo state after the failed first install session (install, lint, tests and typecheck all fine; `LayoutProps` error was only missing generated types). Wrote the JPEG segment map, 8 fixtures from independent encoders, failing tests, then the sniffer, parser, EXIF reader and writer, stripper, verifier and `stripMetadata()`. Verified with exiftool, Pillow pixel comparison, raw byte grep and three deliberate mutations
- Decided: Default deny allow-list; Clean fails closed (re-reads output and compares image data, throws instead of returning an unverified file); trailing data and MPF are removed (drops HDR gain maps); the JFIF thumbnail is dropped; Orientation is carried over even when it is 1
- Next: app shell and single-file Clean UI, then PNG

### 2026-10-05
- Did: Singularity interview (Q1 to Q10), Stitch design rounds, look locked, scaffold pushed (Next.js 16, Vitest, jsx-a11y), BRAIN.md, SITETREE.md (6 routes), Council PRE-BUILD (conditional go), repo docs scaffolded
- Decided: Standalone app with an owner-only dashboard (Neon + Drizzle + Better Auth) instead of third-party analytics; light and dark with a toggle; dark secondary text is warm gray, not Stitch's pink; Clean keeps Orientation and the colour profile and claims "all identifying metadata removed"; modes are UI state on `/`
- Next: run shadcn init locally and write tokens into globals.css, then the JPEG segment map, fixtures and failing tests
