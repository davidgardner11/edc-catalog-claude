# Everyday Carry (EDC) Backpack Catalog App

## Overview 

A digital catalog of the most popular, beloved, and acclaimed Everyday Carry (EDC) Backpacks, disoplayed as a catalog on a filterable grid.

Statically-generated for local-use only due to copyrighted images. No server, no API, and no database.

### Approach

Implemented using **Sub-agents** (`/.claude/agents/`) over several Claude sessions. The primary Claude Agent acted as **Supervisor/Eng Mgr** under my direction.  

- **Result:** app is complete and fully-tested: a filterable, sortable grid of the ingested catalog, with a details page per pack. 
- **Test Automation:** 25 Vitest unit tests and 41 Playwright E2E tests. E2E suite runs against `pnpm dev`.
- **Ingestion:** 17 of 20 packs were ingested. 3 were deliberately ignored ([ADR-033](./docs/decisions.md)). 
- [implementation-plan.md](./implementation-plan.md) contains the architecture, ranked list of 20 backpacks and build order.

## Initial Setup 

> ⚠️ **A fresh clone will not render anything until you run `pnpm ingest`.**
>
Product photos are copyrighted, and this repository is public, so `public/images/` is gitignored and never committed ([ADR-012](./docs/decisions.md)).  

`app/data/catalog.json` is also a build artifact, but it *is* committed ([ADR-030](./docs/decisions.md)) so the app builds on a fresh clone without fetching from a retailer CDN. 

**Requirements:** Node `^24.11 || >=26` and `pnpm`.

```bash
pnpm install
pnpm ingest      # downloads + processes product images, builds app/data/catalog.json
pnpm dev         # http://localhost:3000
```

`pnpm ingest` ingests every backpack in `data/seed.ts` that has a capture in `data/sources/`; Useful flags: `--only=slug[,slug]` to restrict a run, `--skip-fetch` to rebuild from the cache alone, `--reencode` to force every AVIF/WebP variant to be regenerated. Setting `INGEST_OFFLINE=1` makes any outbound request throw, useful for verifying "no re-download" guarantee.

`pnpm ingest` caches data in `.ingest-cache/` (gitignored), so re-running to retune image processing does not re-download anything. Deleting `public/images/` and re-running rebuilds from that cache without touching the network.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Nuxt dev server |
| `pnpm generate` | Static build to `.output/public` |
| `pnpm ingest` | Regenerate `app/data/catalog.json` and `public/images/` from `data/` |
| `pnpm test` | Vitest unit tests |
| `pnpm typecheck` | `nuxt typecheck` via vue-tsc |
| `npx playwright test` | End-to-end tests (Chromium; starts the dev server itself). Also `pnpm test:e2e` |

## The Backpack Card

Each backpack card is split into three sections — 65 / 15 / 20 ([ADR-021](./docs/decisions.md)):

- **Top 65%** — an infinite image carousel, completely unobstructed. Clicking the right half advances, the left half retreats, and both wrap.
- **Middle 15%** — the brand in small uppercase over the model name in bold. Because it is its own grid row rather than an overlay, it cannot move or re-render as the images cycle.
- **Bottom 20%** — three columns: an 8-cell colorway grid (4×2, with a wrapping `>` pager above 8 colorways), the lowest available price with its retailer, and the review score shown against its own scale (`4.4/5.0`, `8.1/10.0`) over its source.

## Architecture

- **Nuxt 4 / Vue 3 / TypeScript**, statically generated via `nuxt generate`
- **Tailwind v4**, CSS-first — no `tailwind.config.js`
- **No state library** — the catalog is a build-time JSON import; filter and sort state lives in URL query params
- **Ingest pipeline** (`scripts/`) — downloads images, processes them with sharp into AVIF + WebP at two widths, and validates the catalog with zod

Full detail in the [implementation plan](./implementation-plan.md); the reasoning behind each decision is stored as an Architecture Decisions Record (ADR) in [`docs/decisions.md`](./docs/decisions.md).

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

Prices and review scores are **point-in-time snapshots**, displayed with timestamps on the backpage detail page. Review scores retain their original scale (5.0 for retailers, 10.0 for enthusiast sites). Thus, the **rating** filter and the **rating sort** compare by `score / scale` (per [ADR-010](./docs/decisions.md)).

## Development

See [`CLAUDE.md`](./CLAUDE.md) for the version ceilings and project invariants. The one most likely to catch you out: **TypeScript is capped at 6.0.3** — TS 7 dropped the compiler API that `vue-tsc` needs to type-check `.vue` files.

## Testing

- `pnpm test` runs 425 Vitest **unit tests** over the app logic in `app/utils/` — price and score formatting, score normalization across both review scales, carousel wraparound, and the 8-cell colorway grid at every boundary. 
- `npx playwright test` runs the **end-to-end test suite** from `tests/e2e/` in Chromium, starting `pnpm dev` on port 3000 itself — it covers the behaviors only observable in a browser, chiefly that the three bands really measure 65 / 15 / 20 and that the carousel label does not shift by a pixel as images cycle. Browser binaries are not installed by `pnpm install`; run `npx playwright install chromium` once after cloning.

## License and content

**Product images and product data are not licensed** — photos come from brand and retailer sites and remain their owners' property. Thus, images are gitignored rather than committed, and this catalog app is for local use only.
