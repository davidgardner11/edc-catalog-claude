# EDC Catalog

A digital catalog of the most popular, beloved, and acclaimed Everyday Carry backpacks, presented as playing-card-proportioned cards (5:7 portrait) in a browsable, filterable grid.

Local-only and statically generated — there is no server, no API, and no database.

> **Status: Phase 4 complete.** The card renders and the ingest pipeline is proven end to end on 3 of the ranked 20 packs. `app/pages/index.vue` still renders the hand-written fixtures rather than the generated catalog — that swap comes with the toolbar in Phase 6. Sections below marked _(pending)_ are filled in as the build progresses. See [`implementation-plan.md`](./implementation-plan.md) for the architecture, ranked pack list, and build order.

---

## Setup

> ⚠️ **A fresh clone will not render anything until you run `pnpm ingest`.**
>
> Product photos are copyrighted, and this repository is public, so `public/images/` is gitignored and never committed ([ADR-012](./docs/decisions.md)). `app/data/catalog.json` is likewise a build artifact. Both are produced by the ingest pipeline from the source data in `data/`.

**Requirements:** Node `^22.19 || ^24.11 || >=26` and pnpm.

```bash
pnpm install
pnpm ingest      # downloads + processes product images, builds app/data/catalog.json
pnpm dev         # http://localhost:3000
```

`pnpm ingest` currently ingests the three packs in `data/seed.ts`; Phase 5 fills in the other seventeen. Useful flags: `--only=slug[,slug]` to restrict a run, `--skip-fetch` to rebuild from the cache alone, `--reencode` to force every AVIF/WebP variant to be regenerated. Setting `INGEST_OFFLINE=1` makes any outbound request throw, which is how the "no re-download" guarantee is verified rather than assumed.

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
  pages/               file-based routes (index.vue; /pack/[slug] pending — Phase 6)
  assets/css/main.css  Tailwind entry + @theme tokens
  components/          BackpackCard, CardCarousel, CardLabel, ColorwayGrid, PriceBlock, ScoreBlock
  composables/         URL-query-backed filter/sort state        (pending — Phase 6)
  utils/               pure logic: format, color, cycle, image
  types/backpack.ts    the data contract
  data/catalog.json    build artifact from `pnpm ingest`         (gitignored)
  data/fixtures.ts     3 hand-written packs; what index.vue renders today
scripts/
  ingest.ts            pipeline entry — preflight, fetch, process, build
  fetch-images.ts      download ≤5 originals → .ingest-cache/{slug}/
  process-images.ts    sharp → public/images/{slug}/{n}-{w}.{avif,webp}
  build-catalog.ts     merge + zod validate → app/data/catalog.json
  lib/                 paths, robots-aware http, zod schemas, logging
data/
  seed.ts              the ranked list: rank, slug, name, brand, rationale
  sources/{slug}.json  per-pack research capture   (3 of 20 — rest is Phase 5)
.ingest-cache/         downloaded originals                      (gitignored)
docs/                  decision log and working notes
.claude/               subagent definitions
nuxt.config.ts         SSG config, Tailwind Vite plugin, TS flags
tsconfig.json          solution-style; real projects are generated under .nuxt/
```

Nuxt 4 keeps source under `app/` — there are no root-level `pages/` or `components/` directories.

## Data

_(3 of 20 packs ingested — the rest is Phase 5)_

Prices and review scores are **point-in-time snapshots**, each stamped with `capturedAt`. Nothing in this catalog is live pricing. Review scores keep their source's own scale rather than being normalized on write.

## Development

See [`CLAUDE.md`](./CLAUDE.md) for the version ceilings and project invariants. The one most likely to catch you out: **TypeScript is capped at 6.0.3** — TS 7 dropped the compiler API that `vue-tsc` needs to type-check `.vue` files.

## Testing

`pnpm test` runs 251 Vitest unit tests over the pure logic in `app/utils/` — price and score formatting, score normalization across both review scales, carousel wraparound, and the 8-cell colorway grid at every boundary. End-to-end tests are Phase 7: the behaviors only observable in a browser, chiefly that the three bands really measure 65 / 15 / 20 and that the carousel label does not shift by a pixel as images cycle.

## License and content

Code is this repository's own. **Product images and product data are not** — photos come from brand and retailer sites and remain their owners' property. That is why images are gitignored rather than committed, and why this catalog is intended for local use rather than public deployment.
