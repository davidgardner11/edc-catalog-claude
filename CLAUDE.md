# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

**Phase 4 complete — the pipeline is proven.** The card renders (`app/types/backpack.ts`, `app/utils/{format,color,cycle,image}.ts`, and the six components `BackpackCard`, `CardCarousel`, `CardLabel`, `ColorwayGrid`, `PriceBlock`, `ScoreBlock`), and `pnpm ingest` works end to end: `scripts/{ingest,fetch-images,process-images,build-catalog}.ts` plus `scripts/lib/`, driven by `data/seed.ts` and `data/sources/{slug}.json`. `pnpm typecheck`, `pnpm test` (251 unit tests) and `pnpm generate` all pass.

Two things that surprise people. **`app/pages/index.vue` still imports `app/data/fixtures.ts`, not `catalog.json`** — the one-line swap is Phase 6, so the page shows the three fixtures even though a real catalog exists on disk. And **only 3 of the ranked 20 are ingested**; the other 17 are Phase 5. Still missing entirely: the toolbar, filters and sort, the `/pack/[slug]` detail route, and any E2E test.

`implementation-plan.md` is the source of truth for architecture, data model, the ranked pack list, ingest design, and build order. Read it before starting work. When implementation diverges from it, update the plan in the same change rather than letting the two drift.

Build order is defined there; next up is Phase 5 — research and ingest the remaining 17 packs, in batches of about five.

## Where things are written down

This file is loaded into **every** subagent automatically, so it stays short and carries only rules that must always hold. Longer reference material lives in files you read on demand:

| File | Contents | Read it when |
| --- | --- | --- |
| `docs/decisions.md` | Append-only decision log — the **why** behind the rules below | Considering changing a pinned version, an architectural constraint, or anything this file states as a rule |
| `docs/component-conventions.md` | Naming, props, logic placement, styling, a11y patterns, card rules | Writing or modifying any Vue component |
| `app/types/backpack.ts` | The data contract, as code *(added at plan Phase 2)* | Touching catalog data in any layer |
| `README.md` | Setup, commands, project overview | Onboarding, or when setup steps change |
| `implementation-plan.md` | Architecture, ranked 19, ingest design, build order, supervision guide | Starting any phase of work |

Do not create a second always-read context file. This one already fills that role; a parallel file would be opt-in, and an agent that forgets to read it drifts silently.

When you make a decision that future work must respect, append an ADR to `docs/decisions.md`. If it is also a rule agents must always follow, add one line here pointing at it — never duplicate the reasoning in both places.

**Never hard-wrap prose in a markdown file.** Write each paragraph as one continuous line and let the renderer wrap it. Manual mid-sentence line returns produce whitespace-only diffs when someone reflows them, and they break string-match edits against text that has been reflowed since it was read. Applies to every `.md` in this repo, including ADRs and anything a subagent writes.

## Commands

pnpm is the package manager (pnpm 9.15.9, Node 24.19 local).

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Nuxt dev server |
| `pnpm generate` | Static build to `.output/public` (also leaves a `dist` symlink to it) |
| `pnpm ingest` | Regenerate `app/data/catalog.json` and `public/images/` from `data/`. Idempotent: re-running on unchanged inputs is byte-identical and makes zero network requests. Flags: `--only=slug[,slug]`, `--skip-fetch`, `--reencode`; `INGEST_OFFLINE=1` makes any outbound request throw |
| `pnpm test` | Vitest unit tests (`--passWithNoTests` until Phase 7) |
| `pnpm typecheck` | `nuxt typecheck` via vue-tsc |
| `npx playwright test` | E2E; single spec via `npx playwright test tests/e2e/<file>.spec.ts` — **not installed yet** (Phase 7) |

`pnpm typecheck` prints `[Vue] Resolve plugin path failed: vue-router/volar/...` warnings. They are cosmetic: vue-tsc 3.3.11 looks for Volar plugin subpaths that vue-router 5 no longer exports. The exit code and TS error count are what matter.

**`pnpm typecheck` does not cover `scripts/` or `data/`** — neither is in any tsconfig project, and `@types/node` is not installed, so the ingest pipeline is checked only by running it (ADR-025).

## Version constraints — do not "upgrade" these

Every one of these looks stale and is not. Verify against the plan before changing a dependency.

- **TypeScript is capped at 6.0.3.** npm `latest` is 7.x and genuinely stable, but TS 7.0 shipped without the programmatic compiler API that `@vue/compiler-sfc` and `vue-tsc` require to type-check `.vue` SFCs. Installing TS 7 breaks type-checking outright. Never run `typescript@latest`. The cap lifts at TS 7.1. `tsconfig.json` sets `"ignoreDeprecations": "6.0"` — resolve deprecation warnings rather than suppressing new ones; that work *is* the eventual 7.1 migration.
- **Vite is not a direct dependency.** `@nuxt/vite-builder` owns it (resolved: 8.2.2). Adding `vite` to `package.json` only creates the opportunity for a version conflict. **`vue-router` is the same case** — Nuxt 4.5.2 depends on `vue-router ^5.2.0`; declaring it yourself silently downgrades it.
- **Nuxt 4, not Nuxt 3.** Source lives under `app/`. Do not create root-level `pages/` or `components/` directories.
- **Vue 3.5.42 is the newest stable.** There is no Vue 4; 3.6 is release-candidate only.
- **Tailwind v4 is CSS-first.** There is no `tailwind.config.js` and creating one does nothing. Theme tokens belong in `@theme` blocks inside `app/assets/css/main.css`. It is wired as a Vite plugin in `nuxt.config.ts` (`vite.plugins`), not as a Nuxt module.
- **`ignoreDeprecations: "6.0"` is set in `nuxt.config.ts`, not just `tsconfig.json`.** The root `tsconfig.json` is solution-style (`files: []` + references), so its `compilerOptions` do not reach the real projects. `typescript.{tsConfig,nodeTsConfig,sharedTsConfig}` and `nitro.typescript.tsConfig` write the flag into every generated `.nuxt/tsconfig.*.json`.

## Architecture

A local-only, statically generated catalog. `nuxt generate` produces pure static output — **there is no server at runtime**: no API routes, no database, no runtime data fetching, no SSR-only APIs.

Consequently there is no state library. The catalog is a build-time JSON import; the only real state is search/filter/sort, which lives in a composable backed by URL query params so views are bookmarkable. Carousel index is local `ref` state per card.

### Data and images are build artifacts

`app/data/catalog.json` and everything under `public/images/` are **generated by `pnpm ingest`** and must never be hand-edited. To change catalog content, edit `data/seed.ts` or `data/sources/{slug}.json` and re-run. Originals are cached in gitignored `.ingest-cache/` so image processing can be retuned without re-fetching from any retailer.

Images are emitted per width as `public/images/{slug}/{n}-{w}.{avif,webp}` for `w ∈ {640, 1280}`. `CarouselImage.base` omits the width and extension; the component builds `` `${base}-${w}.avif ${w}w` `` from `widths`. `width`/`height` are the intrinsic size of the **largest** variant and exist to hold aspect ratio, keeping CLS at zero.

### Invariants that are easy to break

- **`swatchSource` is provenance, not carousel content** (ADR-027). A colorway's `swatchSource` may point at any brand photograph and usually is *not* one of the pack's 1-5 carousel images; `images` and `colorways` are disjoint. The image cap puts no limit on how many colorways can be sampled, and a hex without a `swatchSource` is still incomplete (ADR-025). Colour accuracy is **best-effort, not hex-identical** (ADR-029): never retune the sampler or hand-edit a hex to make a swatch look better — a sampled value that looks dark is working as intended.
- **`ColorFamily` is a closed union of 13 values** (ADR-022), defined in `app/types/backpack.ts`. Ingest maps free-form colorway names onto exactly those members and the toolbar's colour filter facets on exactly those members — if either side invents its own list they disagree silently. Widen the union in the type file; never work around it with a loose `string`.
- **Capacities in the plan's ranked-19 table are unverified** (ADR-023). The stated capacity spread was wrong at both ends and has been withdrawn. Do not quote a capacity range until Phase 5 captures `capacityLiters` per pack.
- **Review scales differ per pack.** `review.scale` is 5.0 (retailer) or 10.0 (enthusiast review sites). Display uses raw `score`/`scale`; **sorting and filtering must use `score / scale` normalized to 0–1.** Conflating these is the easiest bug to introduce here.
- **Card geometry is uniform across every card.** `aspect-[5/7]`, inner `grid grid-rows-[65fr_15fr_20fr]` — three bands: carousel 65%, brand+name 15%, meta row 20% (ADR-021). Use `fr`, **never** `h-[65%]`/`h-[15%]`/`h-[20%]`; fractional rows are what keep the split exact and immune to content pushing it around — but `fr` alone is not enough: every band also needs `min-h-0`, or its automatic min-content floor lets a tall child stretch it (ADR-024). The model name must `truncate` — a wrapping name grows band 2 and breaks the ratio. Band 3 is three columns: colorway grid, price over retailer, score over `review.source`.
- **The carousel label must not move or re-render** when the image changes. Since ADR-021 this is structural for free: the label lives in band 2, a different grid row from the carousel, so nothing that changes on image swap can reach it. Do not reintroduce an overlay label on the card.
- **The colorway grid always renders exactly 8 cells (4 cols × 2 rows)**: ghost-padded at 8 or fewer; above 8, cell 8 becomes a `>` pager showing 7 colorways per page. The pager stays in cell 8 on every page, including a partial last page.
- **Everything cyclable on a card wraps.** The carousel (last→first, first→last) and the colorway pager (last page→first page). Use modulo, never bounds-clamping, and never render a disabled control. The pager's handler must `stopPropagation` so it does not navigate to the detail route.

## Subagents

`.claude/agents/` defines five scoped specialists; prefer them over general edits in their areas.

- **`frontend-specialist`** — `app/`: Vue SFCs, Tailwind, accessibility, responsive layout.
- **`data-pipeline-specialist`** — `scripts/` and `data/`: ingest, sharp, zod.
- **`research-curator`** — web research into `data/sources/{slug}.json`; never runs ingest.
- **`test-engineer`** — `tests/` and `*.test.ts`; reports defects rather than editing app code to make a test pass.
- **`build-tooling-specialist`** — `package.json`, `nuxt.config.ts`, `tsconfig.json`, runner config; enforces the version ceilings above.

There is deliberately no backend agent; this project has no server.

## Repository

Public: `davidgardner11/edc-catalog-claude`. Product photos come from brand and retailer CDNs and are copyrighted, so **`public/images/` is gitignored and never committed** (ADR-012). A fresh clone renders nothing until `pnpm ingest` runs. Do not commit images "just to make the clone work." **`app/data/catalog.json` is committed** (ADR-030) so the app builds on a fresh clone without a network round-trip to a retailer CDN — it is still generated and must never be hand-edited (ADR-014). That buys a clone that *builds*, not one that *renders*: the catalog points at `/images/{slug}/N`, still absent until ingest runs. Ingest now produces a reviewable diff on it; read it, and resolve any merge conflict by re-running ingest rather than hand-merging JSON.

The ingest fetcher must respect `robots.txt`, rate-limit, and fall back (brand-direct → major retailer → manual URL capture) rather than retrying a blocked host in a loop.
