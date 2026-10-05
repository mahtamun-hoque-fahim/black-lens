# Black Lens - Design Guide

Implementation spec for the design system. No rationale. No marketing copy. Just tokens, patterns, and constraints.

The locked look lives in `BRAIN.md` under Visual Identity (Locked). The block below is a verbatim copy. Change the look there first (chameleon RETHEME), then sync here.

## Locked look (copied from BRAIN.md)

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

## Color tokens

One token setup (chameleon `references/tokens.md`): plain variables in `:root` and `.dark`, mapped to Tailwind through `@theme inline`, in `src/app/globals.css`. Dark is the primary design. Mode toggles with a `.dark` class on `<html>`.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";   /* written by shadcn init */

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.75rem;

  --background: #faf8f9;
  --foreground: #131315;
  --card: #ffffff;
  --card-foreground: #131315;
  --popover: #ffffff;
  --popover-foreground: #131315;
  --primary: #dc2626;
  --primary-foreground: #ffffff;
  --secondary: #efeaec;
  --secondary-foreground: #131315;
  --muted: #efeaec;
  --muted-foreground: #5c5558;
  --accent: #efeaec;
  --accent-foreground: #131315;
  --destructive: #b91c1c;
  --success: #15803d;
  --warning: #a16207;
  --info: #0369a1;
  --border: #e2dcdf;
  --input: #8a8386;
  --ring: #dc2626;
  --chart-1: #dc2626;
  --chart-2: #7f1d1d;
  --chart-3: #0369a1;
  --chart-4: #6b6366;
  --chart-5: #a16207;
}

.dark {
  --background: #0e0e10;
  --foreground: #e5e1e4;
  --card: #1b1b1d;
  --card-foreground: #e5e1e4;
  --popover: #201f21;
  --popover-foreground: #e5e1e4;
  --primary: #dc2626;
  --primary-foreground: #fff6f5;
  --secondary: #2a2a2c;
  --secondary-foreground: #e5e1e4;
  --muted: #2a2a2c;
  --muted-foreground: #b8b2b4;
  --accent: #2a2a2c;
  --accent-foreground: #e5e1e4;
  --destructive: #ffb4ab;
  --success: #4ade80;
  --warning: #fbbf24;
  --info: #90cdff;
  --border: #353437;
  --input: #78767a;
  --ring: #dc2626;
  --chart-1: #dc2626;
  --chart-2: #ff9996;
  --chart-3: #90cdff;
  --chart-4: #b8b2b4;
  --chart-5: #fbbf24;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info: var(--info);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}
```

Semantic colours: brand red (`--primary`) is also red, so `--destructive` is deliberately a different value (lighter in dark, darker in light) and is what the GPS warning uses. Do not use `--primary` for warnings or errors.

Contrast notes (checked with `scripts/check_palette.py`, both modes pass AA):
- White-ish text on `--primary` is 4.54:1 (bare pass). Do not lighten the red or shrink button text.
- `--primary` on the dark page is 3.99:1: buttons, icons, focus ring only, never small text.

Utilities: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `hover:bg-primary/90`, `bg-destructive/10`, `border-destructive/40`, `ring-ring`, `border-border`. There is no `tailwind.config.ts` in a Tailwind v4 project. No raw hex in class names.

## Typography

Families (loaded via `next/font/google` in `src/app/layout.tsx`, mapped in `@theme inline` as `--font-heading`, `--font-sans`, `--font-mono`):
- Heading: Inter, weight 600, tracking -0.02em on headlines -> `font-heading`
- Body: Inter -> `font-sans`
- Mono: JetBrains Mono, metadata values only (coordinates, serial numbers, filenames), never labels or body -> `font-mono`

Weights: body 400, emphasis 500, buttons and headings 600.

Size scale: base 16px, ratio 1.2. Body text is never below 15px. Three text sizes per screen, two weights.

| Token | Size | Use |
|---|---|---|
| `text-sm` | 0.875rem | Secondary text, labels |
| `text-base` | 1rem | Body |
| `text-lg` | 1.125rem | Section titles |
| `text-2xl` | 1.5rem | Page headings |
| `text-3xl` | 1.875rem | Home headline |

Line height: 1.6 for body, 1.2 for headings. No small uppercase labels above headings.

## Spacing scale

Tailwind defaults. Common values: 2 (8px), 4 (16px), 6 (24px), 8 (32px), 12 (48px), 16 (64px). Generous spacing, few elements per screen.

## Border radius

`--radius` is 0.75rem. No pills.

| Use | Class |
|---|---|
| Inputs, buttons, tabs, badges | `rounded-lg` |
| Cards, panels, queue rows | `rounded-xl` |

## Shadows

Flat. Surfaces separate by tone (page vs card vs popover), not shadow. Light mode may use one soft card shadow:

```css
:root  { --card-shadow: 0 1px 2px 0 rgb(19 19 21 / 0.06); }
.dark  { --card-shadow: none; }
@theme inline { --shadow-card: var(--card-shadow); }   /* shadow-card */
```

## Components

### Button - primary (the only solid red element on a screen)
```tsx
<button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold hover:bg-primary/90 transition-colors">
  Clean and download
</button>
```

### Button - secondary
```tsx
<button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors">
  Download as ZIP
</button>
```

### Button - ghost
```tsx
<button className="text-muted-foreground hover:text-foreground hover:bg-accent px-3 py-2 rounded-lg transition-colors">
  Clear all
</button>
```

### Input
```tsx
<input className="bg-background border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40 transition-colors" />
```

### Mode tabs (View, Clean, Tag)
Active tab: `bg-primary text-primary-foreground`. Inactive: `text-muted-foreground hover:text-foreground hover:bg-accent`. `rounded-lg`, not pills.

### Card / queue row
```tsx
<div className="bg-card text-card-foreground border border-border rounded-xl p-4">...</div>
```
Selected row: `border-primary`. Never use red for anything else on a row.

### Status chip (file queue)
Words only: "Has location", "Has metadata", "Already clean", "Not supported". "Has location" uses the destructive tokens:
```tsx
<span className="inline-flex items-center px-2 py-0.5 rounded-lg text-sm font-medium bg-destructive/10 text-destructive">Has location</span>
```
Other chips: `bg-muted text-muted-foreground`.

### GPS warning panel (View and Clean inspector)
A filled panel with an icon and one plain sentence ("This photo shows where it was taken."). Destructive tokens, not brand red. No map, no tiles.
```tsx
<div className="bg-destructive/10 border border-destructive/40 text-foreground rounded-xl p-4 flex gap-3">...</div>
```

### Metadata value
Label in `text-muted-foreground font-sans`, value in `font-mono text-foreground`. Each value has a copy button (ghost, icon only, accessible name "Copy <field>").

### Back to top
Fixed bottom-right, the only element in that slot. Shows only when the page is taller than the viewport and the user has scrolled. 44px minimum target. Keep clear of the home indicator: `bottom: calc(1rem + env(safe-area-inset-bottom))`.

## Animation defaults

Medium ceiling (restrained but present):
- Hover and state colour: `transition-colors duration-150 ease-out`
- List rows entering, tab indicator: `transition-[opacity,transform] duration-200 ease-out` (never `transition-all`)
- Progress bar fill: `transition-[width] duration-200 ease-out`
- Maximum UI animation: 250ms. No parallax, no looping motion.

Always honour reduced motion. Movement goes, colour and opacity feedback stays:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-property: color, background-color, border-color, outline-color,
      text-decoration-color, fill, stroke, opacity !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
  .animate-spin {
    animation-duration: 1.5s !important;
    animation-iteration-count: infinite !important;
  }
}
```

## Light and dark notes

Mode: both, with a theme toggle (from BRAIN.md Visual Identity). Dark is the primary design (from Stitch); light is derived from it.

Dark:
- Never pure black for backgrounds: use `--background`. Never pure white text: use `--foreground`.
- Elevation comes from surface lightness (`bg-background` -> `bg-card` -> `bg-popover`), not shadow.

Light:
- Body text is `--foreground`, never `#000`.
- Separate surfaces with hairline borders and small lightness steps.

Every component is checked in both modes. The theme toggle sits in the header and respects `prefers-color-scheme` on first load.

## Focus indicators

Always visible. Never `outline: none` without a replacement.

```css
*:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

## Copy rules

- Plain human wording. Banned in the UI: enclave, air-gapped, forensic, telemetry, sandbox, cryptographic, console, egress.
- No hashes, version strings, fake statistics, status tickers, or log consoles.
- No emojis. lucide-react icons only. No em dashes in copy.
- Cleaning copy says "all identifying metadata removed" and names what was kept. Never "zero metadata" or "zero tags remain".
- Never claim "zero external calls". The honest claim is that photos never leave the device.
- Supported formats are stated as JPEG, PNG, WebP.
