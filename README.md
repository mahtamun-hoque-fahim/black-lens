# Black Lens

![Version](https://img.shields.io/github/v/release/mahtamun-hoque-fahim/black-lens?include_prereleases&style=flat-square&color=dc2626)
![License](https://img.shields.io/github/license/mahtamun-hoque-fahim/black-lens?style=flat-square)
![Stars](https://img.shields.io/github/stars/mahtamun-hoque-fahim/black-lens?style=flat-square)

A free, in-browser tool that shows the hidden metadata inside photos, removes the identifying parts, and optionally writes your own author and copyright details. Photos never leave the device.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Neon (PostgreSQL) + Drizzle ORM, for the owner dashboard counters only (dashboard phase)
- Better Auth, single owner, signups disabled (dashboard phase)
- Vercel

## Prerequisites

- Node 20.9+
- A Neon project with pooled and unpooled connection strings (dashboard phase only)

## Local setup

1. Clone the repo: `git clone https://github.com/mahtamun-hoque-fahim/black-lens.git`
2. Install: `npm install`
3. Copy `.env.example` to `.env.local` and fill in values (see PLANNER.md, Env Vars)
4. Run dev: `npm run dev`

## Env vars

See PLANNER.md, Env Vars for descriptions. Names only (exactly the names in `.env.example`):

```
NEXT_PUBLIC_SITE_URL
DATABASE_URL
DATABASE_URL_UNPOOLED
BETTER_AUTH_SECRET
BETTER_AUTH_URL
OWNER_EMAIL
OWNER_PASSWORD
```

## Scripts

```bash
npm run dev          # local dev server
npm run build        # production build
npm run start        # serve production build
npm run lint         # ESLint
npm test             # unit and component tests (Vitest)
```

## Deploy

- Push to `main`: Vercel auto-deploys to production
- Push to any other branch: Vercel preview deploy

Before promoting a deploy, verify env vars are set in Vercel (Production and Preview).

## Folder structure

```
src/app/         routes (App Router)
src/components/  UI primitives (ui/) and sections
src/lib/         utils and the pure metadata core
```

For the detailed structure, see PLANNER.md, Architecture.

## License

MIT. See [LICENSE](LICENSE).
