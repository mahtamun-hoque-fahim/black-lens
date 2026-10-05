# BRAIN.md — Black Lens

> This file is maintained by the Singularity skill. It is the identity document of this project.
> When Claude drifts, hallucinates, or loses context, this file is the source of truth.
> Do not confuse this with PLANNER.md (tasks/phases) or DESIGN_GUIDE.md (design tokens).

---

## The One-Line Truth

Black Lens is a free, in-browser tool that shows what hidden metadata is inside photos, removes it, and optionally writes the owner's own author and copyright details, with the photos never leaving the device.

---

## Why It Exists

Photos carry GPS location, camera serial numbers, timestamps and editing history, and most people publish them without knowing. Existing tools are usually desktop-only, upload-based, or read-only, and none combines a client-side workflow, batch, folder and ZIP input, a clear "what we found" view, and writing your own fields back. It is built first for Fahim, who strips location from his own photos and stamps Artist and Copyright on work he publishes, and second as a showcase piece with its own URL and identity. Honest framing: nobody else is worse off if it never exists. The stakes are the showcase, his own use, and the learning.

---

## What It Must Become

A tool people trust on sight because the privacy claim can be checked, and one Fahim reaches for by reflex. Clean mode works end to end first. The same core logic later ships as a local CLI and a local MCP server. It stays small and single-purpose.

---

## Core Decisions (Locked)

These decisions are final. Claude must not question or work around them without explicit confirmation from Fahim.

- [LOCKED] Name is Black Lens, repo and folder `black-lens`
- [LOCKED] Standalone app: its own repo, Vercel project, URL and brand. Reason: showcase and learning build
- [LOCKED] Client-side only. Reading, stripping and writing happen in the browser. No photo or metadata is ever uploaded
- [LOCKED] Three modes: View (read-only, with a GPS warning), Clean (strip all identifying metadata, the default), Tag (strip identifying metadata, then write only the fields the user chose). Tag ships after Clean
- [LOCKED] Input: single file, batch, folder, or ZIP
- [LOCKED] Formats in v1: JPEG, PNG, WebP. HEIC and others show as "not supported yet" with a plain explanation
- [LOCKED] Stripping is lossless: pixels are untouched, no re-encoding
- [LOCKED] What Clean removes and keeps: Clean removes everything that identifies the person, device, place, time or software. It keeps only what is needed to display the image correctly: the EXIF Orientation flag, the colour profile (ICC), and structural data the format needs to render (for example the JPEG colour-mode flag, PNG gamma and chromaticity chunks). A "remove colour profile too" switch exists and is off by default. The result screen always lists exactly what was kept and why. The claim is "all identifying metadata removed", never "zero tags remain". The per-format segment map is written before the strip code (Council PRE requirement 1)
- [LOCKED] Tag presets are stored on the device only (localStorage)
- [LOCKED] Analytics is option C: a private, owner-only dashboard on Neon + Drizzle + Better Auth showing aggregate counts only. Signups are disabled and there is one owner login. The dashboard must exist before the public showcase
- [LOCKED] Usage counters never contain filenames, metadata contents, or anything from inside a file. The privacy page names the counters
- [LOCKED] CLI and MCP server come after the web tool, as thin wrappers over the same core. The MCP server runs locally only, never hosted remotely
- [LOCKED] Mode is both light and dark with a theme toggle
- [LOCKED] Hosting is Vercel only

---

## Visual Identity (Locked)

> Written by chameleon in Phase 1.5. Values are locked. If a tint is needed, use an opacity modifier and flag it for Fahim.

```
THEME: Custom: Black Lens (quiet black and red utility)
THEME-CHARACTER: Near-black, calm, plain-language file tool with one red brand colour. Queue on the left, inspector on the right, short grouped lists instead of dense consoles.
MODE: both (theme toggle on). Dark is the primary design; light is the derived pair.
SOURCES: Google Stitch export, 7 dark screens (home, View, Clean, Clean results, Tag, Tag workspace, workspace); Stitch round 1 (black and amber) rejected as too dense. Component sources not named, defaults: Motion-Primitives, Watermelon UI.
DEFAULTS USED: image style (photography); component sources; light palette (derived from the dark one, not from Stitch); success, warning, info, input, charts and sidebar values (derived); dark muted-foreground changed from Stitch's pink (#e6bdb8) to warm gray at Fahim's request.

Palette (variable names from references/tokens.md):
  Light (:root)
  background          #faf8f9
  foreground          #131315
  card                #ffffff     card-foreground     #131315
  popover             #ffffff     popover-foreground  #131315
  primary             #dc2626     primary-foreground  #ffffff   (the brand colour)
  secondary           #efeaec     secondary-foreground #131315
  muted               #efeaec     muted-foreground    #5c5558
  accent              #efeaec     accent-foreground   #131315   (hover/selected bg only)
  destructive         #b91c1c     success #15803d   warning #a16207   info #0369a1
  border              #e2dcdf     input               #8a8386   ring  #dc2626
  chart-1..5          #dc2626 #7f1d1d #0369a1 #6b6366 #a16207

  Paired dark palette (.dark)
  background          #0e0e10
  foreground          #e5e1e4
  card                #1b1b1d     card-foreground     #e5e1e4
  popover             #201f21     popover-foreground  #e5e1e4
  primary             #dc2626     primary-foreground  #fff6f5
  secondary           #2a2a2c     secondary-foreground #e5e1e4
  muted               #2a2a2c     muted-foreground    #b8b2b4
  accent              #2a2a2c     accent-foreground   #e5e1e4
  destructive         #ffb4ab     success #4ade80   warning #fbbf24   info #90cdff
  border              #353437     input               #78767a   ring  #dc2626
  chart-1..5          #dc2626 #ff9996 #90cdff #b8b2b4 #fbbf24
Palette check: PASS, 2026-10-05 (scripts/check_palette.py, light and dark, 0 pairs below WCAG AA)
Notes: white text on the red button is 4.54:1 (bare pass), so do not lighten the red or shrink button text. Red on the dark page is 3.99:1: fine for buttons, icons and focus rings, never for small text.

Type (Google Fonts only, load with next/font/google):
  heading  Inter  (weight 600, tracking -0.02em on headlines)  -> font-heading
  body     Inter                                              -> font-sans
  mono     JetBrains Mono  (metadata values only, never labels or body)  -> font-mono
  scale    base 16px, ratio 1.2 (scripts/type_scale.py output in @theme)
  Font check against next/font still to run once dependencies are installed locally.

Radii:   --radius 0.75rem. Inputs and buttons rounded-lg, cards rounded-xl, no pills.
Shadow:  flat. Surfaces separate by tone (page vs card), not shadow. At most one soft card shadow, light mode only.
Motion:  restrained but present: 150 to 250ms fades and slides on state change, tab indicator, list rows entering, progress bar. No parallax, no looping motion. prefers-reduced-motion respected.
Motion-ceiling: medium (Fahim said "more than calm", read as "some")
Scoped constraints:
  - Red (primary) only on the primary button, active tab, focus ring and progress. Everything else is neutral.
  - The GPS warning is a filled panel using the destructive tokens (bg-destructive/10, border-destructive/40), an icon and a plain sentence. It must not be the same red as the brand button.
  - Plain human wording. Banned words in the UI: enclave, air-gapped, forensic, telemetry, sandbox, cryptographic, console, egress. No hashes, version strings, fake statistics, status tickers or log consoles.
  - No maps, no embedded map tiles or any request that carries image data off the device.
  - Never claim "zero external calls". The only honest claim is that photos never leave the device. The privacy page names the anonymous usage counters.
  - No emojis, lucide-react icons only. No em dashes in copy. No small uppercase labels above headings.
  - Never #00e676. WCAG 2.2 AA, both modes.
  - Supported formats stated everywhere as JPEG, PNG, WebP. HEIC is "not supported yet" with a plain explanation.
Image-brief style: photography (default). The user's own photos are the main visuals. Any marketing image: high-contrast monochrome photography (architecture, coastline), deep blacks, no people, no stock-photo smiles.
```

---

## Features

> Written by Singularity in Phase 1.6. Build skills add **only** what is listed here. To add a feature later, update this section first.

Always on (every site):
- Skip link, 404 page, `focus-visible` styles, print stylesheet, accessibility basics (landmarks, labels, AA contrast)
- Visible "Updated" date on dated content: none

Opt-in (checked = build it):
- [x] Theme toggle
- [ ] Site search
- [ ] Newsletter signup
- [ ] Cookie banner: tools that set cookies: none (usage counters set no cookies; the owner login session cookie is essential)
- [ ] Floating contact button
- [x] Back to top: shows only when the page is taller than the viewport and the user has scrolled; must work on phones (44px target, respects safe-area insets, reduced motion)
- [ ] Scroll progress bar
- [x] Copy to clipboard: where: individual metadata values on View (coordinates, serial numbers) and the full list
- [ ] UTM tags on campaign links
- [ ] Heavy motion / 3D

Bottom-right slot (one element only): back to top

## Operator

> Written from interview Q10. Warden builds the legal pages and the footer business details from it.

- Runs the site: Mahtamun Hoque Fahim (individual)
- Address: Chattogram, Bangladesh [CONFIRM: street address, warden will ask before launch]
- Contact: mahtamunhoquefahim@pm.me
- Registration: none
- Visitors and customers in: everywhere
- Children could use it: anyone can visit; there is no sign-up and no personal data is collected from visitors
- Sells: nothing

---

## What It Must Never Become

- Never an app with accounts for visitors
- Never ad-supported
- Never per-user tracking: only aggregate counts, owner-only
- Never an uploader: no photo, metadata or filename leaves the device
- Never an image editor or compressor
- Never a tool that makes a network request carrying image data (no map tiles, no remote previews)
- Never a hosted remote MCP server

---

## Current State

```
Status: Alpha (scaffold only)
Last updated: 2026-10-05

What works:
- Next.js 16 scaffold, Vitest and Testing Library, jsx-a11y, AGENTS.md Session Start block
- Visual identity locked (light and dark pair, contrast checked)
- Stitch screens exist for home, View, Clean, Clean results, Tag and workspace (dark only, copy to be replaced)

What's broken or incomplete:
- No product code yet. shadcn init still to run locally
- No dashboard screens designed yet (owner sign-in and dashboard)
- Light mode never designed, only derived

What's next (in spirit, not tasks):
- Clean mode end to end, then View, then Tag, then the owner dashboard, then CLI and MCP
```

---

## The Stack (Frozen)

These are confirmed for this project. Do not suggest alternatives unless Fahim initiates a migration.

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router, TypeScript, Tailwind CSS v4, shadcn/ui |
| Database | Neon (PostgreSQL) + Drizzle ORM, for the owner dashboard counters only |
| Auth | Better Auth, single owner, signups disabled |
| Payments | none |
| File uploads | none |
| Email | none |
| Analytics | custom owner dashboard, aggregate counts, no cookies |
| Content | TypeScript files in `src/content` |
| Hosting | Vercel |

`none` means none: build, planning and audit skills skip everything for that
layer (no packages, env vars, tasks or checks).

---

## Constraints & Non-Negotiables

- No emojis in UI: lucide-react icons only
- No Supabase
- Vercel only: no Cloudflare Workers, no OpenNext
- Fonts load through next/font (self-hosted at build). No runtime requests to third-party hosts
- Photos never leave the device. The only network request the app makes is the aggregate counter, to its own origin
- Never claim "zero external calls". The honest claim is that photos never leave the device
- Supported formats are stated everywhere as JPEG, PNG, WebP
- Plain human wording. No fake security vocabulary (see Scoped constraints)

---

## Context Hooks (for Claude)

- The Stitch screens are layout references only. Their copy, version strings, maps, stock portrait and "console" language are all wrong for this product and must not be copied
- Claims must match what is built. Do not claim WebAssembly, ExifTool, air-gapping, an enclave or cryptographic signing unless it actually exists
- Copy about cleaning says "all identifying metadata removed" and lists what was kept (Orientation, colour profile). Never write "zero metadata" or "zero tags remain" in the UI, the README or the demo
- Keep the core read, strip and write logic in pure functions with no DOM dependency so a CLI and a local MCP server can reuse it later
- The brand red is only for primary buttons, the active tab, focus and progress. The GPS warning uses the destructive tokens, not the brand red
- Fahim's honest gap is depth under what he ships: explain the byte-level format work (JPEG segments, PNG chunks, WebP RIFF) as it is built so he understands each layer

---

*Last updated by Singularity on 2026-10-05*
