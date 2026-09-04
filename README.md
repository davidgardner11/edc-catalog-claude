# Everyday Carry (EDC) Backpack Catalog App

A digital catalog of the most popular, beloved, and acclaimed Everyday Carry backpacks, presented as playing-card-proportioned cards (5:7 portrait) in a browsable, filterable grid.

Local-only and statically generated — there is no server, no API, and no database.

> **Status: Phase 6 complete.** The app is whole: a filterable, sortable grid of the ingested catalog, and a prerendered detail page per pack. 17 of the ranked 19 packs are ingested — ranks 7 and 16 are reserved and deliberately absent ([ADR-033](./docs/decisions.md)), so rank gaps are expected. What is left is Phase 7, the test suite: `app/utils/catalog.ts` has no unit tests yet and there are no E2E tests at all. See [`implementation-plan.md`](./implementation-plan.md) for the architecture, ranked pack list, and build order.

---

## Setup

> ⚠️ **A fresh clone will not render anything until you run `pnpm ingest`.**
>
> Product photos are copyrighted, and this repository is public, so `public/images/` is gitignored and never committed ([ADR-012](./docs/decisions.md)). `app/data/catalog.json` is also a build artifact, but it *is* committed ([ADR-030](./docs/decisions.md)) so the app builds on a fresh clone without fetching from a retailer CDN. Both come from the ingest pipeline and must never be hand-edited — **a fresh clone builds, but renders no images until `pnpm ingest` runs.**

**Requirements:** Node `^22.19 || ^24.11 || >=26` and pnpm.

```bash
pnpm install
pnpm ingest      # downloads + processes product images, builds app/data/catalog.json
pnpm dev         # http://localhost:3000
```

`pnpm ingest` ingests every pack in `data/seed.ts` that has a capture in `data/sources/`; that is 17 of 19 today. Useful flags: `--only=slug[,slug]` to restrict a run, `--skip-fetch` to rebuild from the cache alone, `--reencode` to force every AVIF/WebP variant to be regenerated. Setting `INGEST_OFFLINE=1` makes any outbound request throw, which is how the "no re-download" guarantee is verified rather than assumed.

`pnpm ingest` is network-bound on a cold run. It caches originals in `.ingest-cache/` (also gitignored), so re-running to retune image processing does not re-download anything. Deleting `public/images/` and re-running rebuilds from that cache without touching the network.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Nuxt dev server |
| `pnpm generate` | Static build to `.output/public` |
| `pnpm ingest` | Regenerate `app/data/catalog.json` and `public/images/` from `data/` |
| `pnpm test` | Vitest unit tests |
| `pnpm typecheck` | `nuxt typecheck` via vue-tsc |
| `npx playwright test` | End-to-end tests _(not installed until Phase 7)_ |

## The card

Each card is a 5:7 portrait split into three bands — 65 / 15 / 20 ([ADR-021](./docs/decisions.md)):

- **Top 65%** — an infinite image carousel, completely unobstructed. Clicking the right half advances, the left half retreats, and both wrap.
- **Middle 15%** — the brand in small uppercase over the model name in bold. Because it is its own grid row rather than an overlay, it cannot move or re-render as the images cycle.
- **Bottom 20%** — three columns: an 8-cell colorway grid (4×2, with a wrapping `>` pager above 8 colorways), the lowest available price with its retailer, and the review score shown against its own scale (`4.4/5.0`, `8.1/10.0`) over its source.

## Architecture

- **Nuxt 4 / Vue 3 / TypeScript**, statically generated via `nuxt generate`
- **Tailwind v4**, CSS-first — no `tailwind.config.js`
- **No state library** — the catalog is a build-time JSON import; filter and sort state lives in URL query params
- **Ingest pipeline** (`scripts/`) — downloads images, processes them with sharp into AVIF + WebP at two widths, and validates the catalog with zod

Full detail in the [implementation plan](./implementation-plan.md); the reasoning behind each choice is in [`docs/decisions.md`](./docs/decisions.md).

## Project layout

```
app/
  app.vue              root component
  pages/               file-based routes: index.vue and pack/[slug].vue
  assets/css/main.css  Tailwind entry + @theme tokens
  components/          card: BackpackCard, CardCarousel, CardLabel, ColorwayGrid, PriceBlock, ScoreBlock
                       shell: CatalogToolbar, FacetCheckboxGroup, PackGallery
  composables/         useCatalogFilters — URL-query-backed filter/sort state
  utils/               pure logic: format, color, cycle, image, catalog
  types/backpack.ts    the data contract
  data/catalog.json    build artifact from `pnpm ingest`         (committed)
  data/catalog.ts      the only module that imports catalog.json
  data/fixtures.ts     3 hand-written packs; the unit tests' harness, not page content
scripts/
  ingest.ts            pipeline entry — preflight, fetch, process, build
  fetch-images.ts      download ≤5 originals → .ingest-cache/{slug}/
  process-images.ts    sharp → public/images/{slug}/{n}-{w}.{avif,webp}
  build-catalog.ts     merge + zod validate → app/data/catalog.json
  lib/                 paths, robots-aware http, zod schemas, logging
data/
  seed.ts              the ranked list: rank, slug, name, brand, rationale
  sources/{slug}.json  per-pack research capture   (17 of 19 — see ADR-033)
.ingest-cache/         downloaded originals                      (gitignored)
docs/                  decision log and working notes
.claude/               subagent definitions
nuxt.config.ts         SSG config, Tailwind Vite plugin, TS flags
tsconfig.json          solution-style; real projects are generated under .nuxt/
```

Nuxt 4 keeps source under `app/` — there are no root-level `pages/` or `components/` directories.

## Data

_(17 of the ranked 19 ingested; ranks 7 and 16 are reserved and absent — [ADR-033](./docs/decisions.md))_

Prices and review scores are **point-in-time snapshots**, each stamped with `capturedAt` and shown with it on the detail page. Nothing in this catalog is live pricing. Review scores keep their source's own scale (5.0 for retailers, 10.0 for enthusiast sites) rather than being normalized on write — so the UI displays the raw `score`/`scale` pair, and the rating filter and the rating sort compare `score / scale` instead ([ADR-010](./docs/decisions.md)).

## Development

See [`CLAUDE.md`](./CLAUDE.md) for the version ceilings and project invariants. The one most likely to catch you out: **TypeScript is capped at 6.0.3** — TS 7 dropped the compiler API that `vue-tsc` needs to type-check `.vue` files.

## Testing

`pnpm test` runs 251 Vitest unit tests over the pure logic in `app/utils/` — price and score formatting, score normalization across both review scales, carousel wraparound, and the 8-cell colorway grid at every boundary. End-to-end tests are Phase 7: the behaviors only observable in a browser, chiefly that the three bands really measure 65 / 15 / 20 and that the carousel label does not shift by a pixel as images cycle.

## License and content

Code is this repository's own. **Product images and product data are not** — photos come from brand and retailer sites and remain their owners' property. That is why images are gitignored rather than committed, and why this catalog is intended for local use rather than public deployment.
