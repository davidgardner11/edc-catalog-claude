# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

**Phase 1 complete — scaffolded.** `package.json`, `nuxt.config.ts`, `tsconfig.json`,
`app/{app.vue,pages/index.vue,assets/css/main.css}` and a `scripts/ingest.ts` stub exist.
`pnpm dev` and `pnpm generate` both work; the index page is a placeholder. No types, fixtures,
components, or real ingest code yet.

`edc-catalog-app-implementation-plan.md` is the source of truth for architecture, data model, the
ranked pack list, ingest design, and build order. Read it before starting work. When implementation
diverges from it, update the plan in the same change rather than letting the two drift.

Build order is defined there; next up is Phase 2 — `app/types/backpack.ts` plus fixtures.

## Where things are written down

This file is loaded into **every** subagent automatically, so it stays short and carries only rules
that must always hold. Longer reference material lives in files you read on demand:

| File | Contents | Read it when |
| --- | --- | --- |
| `docs/decisions.md` | Append-only decision log — the **why** behind the rules below | Considering changing a pinned version, an architectural constraint, or anything this file states as a rule |
| `docs/component-conventions.md` | Naming, props, slots, file layout *(added at plan Phase 3)* | Writing or modifying any Vue component |
| `app/types/backpack.ts` | The data contract, as code *(added at plan Phase 2)* | Touching catalog data in any layer |
| `README.md` | Setup, commands, project overview | Onboarding, or when setup steps change |
| `edc-catalog-app-implementation-plan.md` | Architecture, ranked 20, ingest design, build order, supervision guide | Starting any phase of work |

Do not create a second always-read context file. This one already fills that role; a parallel file
would be opt-in, and an agent that forgets to read it drifts silently.

When you make a decision that future work must respect, append an ADR to `docs/decisions.md`. If it
is also a rule agents must always follow, add one line here pointing at it — never duplicate the
reasoning in both places.

## Commands

pnpm is the package manager (pnpm 9.15.9, Node 24.19 local).

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Nuxt dev server |
| `pnpm generate` | Static build to `.output/public` (also leaves a `dist` symlink to it) |
| `pnpm ingest` | Regenerate `app/data/catalog.json` and `public/images/` from `data/` — **stub until Phase 4**; exits 1 with a pointer to the plan |
| `pnpm test` | Vitest unit tests (`--passWithNoTests` until Phase 7) |
| `pnpm typecheck` | `nuxt typecheck` via vue-tsc |
| `npx playwright test` | E2E; single spec via `npx playwright test tests/e2e/<file>.spec.ts` — **not installed yet** (Phase 7) |

`pnpm typecheck` prints `[Vue] Resolve plugin path failed: vue-router/volar/...` warnings. They are
cosmetic: vue-tsc 3.3.11 looks for Volar plugin subpaths that vue-router 5 no longer exports. The
exit code and TS error count are what matter.

## Version constraints — do not "upgrade" these

Every one of these looks stale and is not. Verify against the plan before changing a dependency.

- **TypeScript is capped at 6.0.3.** npm `latest` is 7.x and genuinely stable, but TS 7.0 shipped
  without the programmatic compiler API that `@vue/compiler-sfc` and `vue-tsc` require to type-check
  `.vue` SFCs. Installing TS 7 breaks type-checking outright. Never run `typescript@latest`. The cap
  lifts at TS 7.1. `tsconfig.json` sets `"ignoreDeprecations": "6.0"` — resolve deprecation warnings
  rather than suppressing new ones; that work *is* the eventual 7.1 migration.
- **Vite is not a direct dependency.** `@nuxt/vite-builder` owns it (resolved: 8.2.2). Adding `vite`
  to `package.json` only creates the opportunity for a version conflict. **`vue-router` is the same
  case** — Nuxt 4.5.2 depends on `vue-router ^5.2.0`; declaring it yourself silently downgrades it.
- **Nuxt 4, not Nuxt 3.** Source lives under `app/`. Do not create root-level `pages/` or
  `components/` directories.
- **Vue 3.5.42 is the newest stable.** There is no Vue 4; 3.6 is release-candidate only.
- **Tailwind v4 is CSS-first.** There is no `tailwind.config.js` and creating one does nothing. Theme
  tokens belong in `@theme` blocks inside `app/assets/css/main.css`. It is wired as a Vite plugin in
  `nuxt.config.ts` (`vite.plugins`), not as a Nuxt module.
- **`ignoreDeprecations: "6.0"` is set in `nuxt.config.ts`, not just `tsconfig.json`.** The root
  `tsconfig.json` is solution-style (`files: []` + references), so its `compilerOptions` do not reach
  the real projects. `typescript.{tsConfig,nodeTsConfig,sharedTsConfig}` and
  `nitro.typescript.tsConfig` write the flag into every generated `.nuxt/tsconfig.*.json`.

## Architecture

A local-only, statically generated catalog. `nuxt generate` produces pure static output — **there is
no server at runtime**: no API routes, no database, no runtime data fetching, no SSR-only APIs.

Consequently there is no state library. The catalog is a build-time JSON import; the only real state
is search/filter/sort, which lives in a composable backed by URL query params so views are
bookmarkable. Carousel index is local `ref` state per card.

### Data and images are build artifacts

`app/data/catalog.json` and everything under `public/images/` are **generated by `pnpm ingest`** and
must never be hand-edited. To change catalog content, edit `data/seed.ts` or
`data/sources/{slug}.json` and re-run. Originals are cached in gitignored `.ingest-cache/` so image
processing can be retuned without re-fetching from any retailer.

Two derived fields are computed once at ingest and must never be recomputed at runtime: each image's
`labelColor` (white or black, by WCAG relative luminance sampled over the label's bounding box) and
`needsScrim`. Do not sample a canvas in a component.

Images are emitted per width as `public/images/{slug}/{n}-{w}.{avif,webp}` for `w ∈ {640, 1280}`.
`CarouselImage.base` omits the width and extension; the component builds
`` `${base}-${w}.avif ${w}w` `` from `widths`. `width`/`height` are the intrinsic size of the
**largest** variant and exist to hold aspect ratio, keeping CLS at zero.

### Invariants that are easy to break

- **Review scales differ per pack.** `review.scale` is 5.0 (retailer) or 10.0 (enthusiast review
  sites). Display uses raw `score`/`scale`; **sorting and filtering must use `score / scale`
  normalized to 0–1.** Conflating these is the easiest bug to introduce here.
- **The carousel label must not move or re-render** when the image changes. It is a sibling of the
  `<img>` and is never keyed to the image index — enforce structurally, not by convention.
- **Card geometry is uniform across every card.** `aspect-[5/7]`, and the 65/35 split uses
  `grid-rows-[65fr_35fr]` rather than percentage heights so content cannot shift it. The colorway
  grid always renders exactly **8 cells (4 cols × 2 rows)**: ghost-padded at 8 or fewer; above 8,
  cell 8 becomes a `>` pager showing 7 colorways per page. The pager stays in cell 8 on every page,
  including a partial last page.
- **Everything cyclable on a card wraps.** The carousel (last→first, first→last) and the colorway
  pager (last page→first page). Use modulo, never bounds-clamping, and never render a disabled
  control. The pager's handler must `stopPropagation` so it does not also advance the carousel or
  navigate to the detail route.

## Subagents

`.claude/agents/` defines five scoped specialists; prefer them over general edits in their areas.

- **`frontend-specialist`** — `app/`: Vue SFCs, Tailwind, accessibility, responsive layout.
- **`data-pipeline-specialist`** — `scripts/` and `data/`: ingest, sharp, contrast precompute, zod.
- **`research-curator`** — web research into `data/sources/{slug}.json`; never runs ingest.
- **`test-engineer`** — `tests/` and `*.test.ts`; reports defects rather than editing app code to
  make a test pass.
- **`build-tooling-specialist`** — `package.json`, `nuxt.config.ts`, `tsconfig.json`, runner config;
  enforces the version ceilings above.

There is deliberately no backend agent; this project has no server.

## Repository

Public: `davidgardner11/edc-catalog-claude`. Product photos come from brand and retailer CDNs and are
copyrighted, so **`public/images/` is gitignored and never committed** (ADR-012). A fresh clone
renders nothing until `pnpm ingest` runs — the same is already true of `app/data/catalog.json`, so
ingest was always a required setup step. Do not commit images "just to make the clone work."

The ingest fetcher must respect `robots.txt`, rate-limit, and fall back (brand-direct → major
retailer → manual URL capture) rather than retrying a blocked host in a loop.
