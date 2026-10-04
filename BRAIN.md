# BRAIN.md: Black Lens (in progress)

Written by Singularity. This file holds the identity of the project. The
Visual Identity block below was locked first by chameleon (Phase 1.5).
Remaining sections are added after the features question.

## Visual Identity (Locked)

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
Palette check: PASS, 2026-10-04 (scripts/check_palette.py, light and dark, 0 pairs below WCAG AA)
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
