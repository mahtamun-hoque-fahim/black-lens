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
- Status: Building MVP (foundation)
- Works: Next.js 16 scaffold, Vitest and Testing Library, jsx-a11y; BRAIN.md, SITETREE.md, COUNCIL.md, PLANNER.md, DESIGN_GUIDE.md locked and committed; look locked (light and dark pair, contrast checked)
- In progress: nothing half-built. No product code yet
- Next: run `shadcn init` locally and write the locked tokens into `globals.css`; per-format segment map and fixtures; failing tests for the JPEG reader and stripper
- Watch out: shadcn init could not run in the sandbox (no access to ui.shadcn.com); the Stitch screens are layout references only, their copy and claims are wrong for this product; HEIC is "not supported yet" in v1; a classic GitHub token was used in the setup session and must be revoked

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
- Type check: `npx tsc --noEmit`
- Lint: `npx eslint .`
- Tests: `npm test` (Vitest)
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

### 2026-10-05
- Did: Singularity interview (Q1 to Q10), Stitch design rounds, look locked, scaffold pushed (Next.js 16, Vitest, jsx-a11y), BRAIN.md, SITETREE.md (6 routes), Council PRE-BUILD (conditional go), repo docs scaffolded
- Decided: Standalone app with an owner-only dashboard (Neon + Drizzle + Better Auth) instead of third-party analytics; light and dark with a toggle; dark secondary text is warm gray, not Stitch's pink; Clean keeps Orientation and the colour profile and claims "all identifying metadata removed"; modes are UI state on `/`
- Next: run shadcn init locally and write tokens into globals.css, then the JPEG segment map, fixtures and failing tests
