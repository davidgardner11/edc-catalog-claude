# EDC Catalog

A digital catalog of the most popular, beloved, and acclaimed Everyday Carry backpacks, presented as
playing-card-proportioned cards (5:7 portrait) in a browsable, filterable grid.

Local-only and statically generated — there is no server, no API, and no database.

> **Status: pre-implementation.** Planning is complete; no application code exists yet. Sections
> below marked _(pending)_ are filled in as the build progresses. See
> [`edc-catalog-app-implementation-plan.md`](./edc-catalog-app-implementation-plan.md) for the
> architecture, ranked pack list, and build order.

---

## Setup

> ⚠️ **A fresh clone will not render anything until you run `pnpm ingest`.**
>
> Product photos are copyrighted, and this repository is public, so `public/images/` is gitignored
> and never committed ([ADR-012](./docs/decisions.md)). `app/data/catalog.json` is likewise a build
> artifact. Both are produced by the ingest pipeline from the source data in `data/`.

**Requirements:** Node `^22.19 || ^24.11 || >=26` and pnpm.

```bash
pnpm install
pnpm ingest      # downloads + processes product images, builds app/data/catalog.json
pnpm dev         # http://localhost:3000
```

`pnpm ingest` is network-bound on a cold run. It caches originals in `.ingest-cache/` (also
gitignored), so re-running to retune image processing does not re-download anything. Deleting
`public/images/` and re-running rebuilds from that cache without touching the network.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Nuxt dev server |
| `pnpm generate` | Static build to `.output/public` |
| `pnpm ingest` | Regenerate `app/data/catalog.json` and `public/images/` from `data/` |
| `pnpm test` | Vitest unit tests |
| `npx playwright test` | End-to-end tests |

## The card

_(pending — Phase 3)_

Each card is a 5:7 portrait split 65 / 35:

- **Top 65%** — an infinite image carousel. Clicking the right half advances, the left half retreats,
  and both wrap. The brand/model label overlays the image and never moves or re-renders as images
  cycle. Its color is white or black, whichever wins on WCAG contrast, precomputed at ingest.
- **Bottom 35%** — three regions: an 8-cell colorway grid (4×2, with a wrapping `>` pager above 8
  colorways), the lowest available price with its retailer, and the review score shown against its
  own scale (`4.4/5.0`, `8.1/10.0`).

## Architecture

_(pending — expanded as the build lands)_

- **Nuxt 4 / Vue 3 / TypeScript**, statically generated via `nuxt generate`
- **Tailwind v4**, CSS-first — no `tailwind.config.js`
- **No state library** — the catalog is a build-time JSON import; filter and sort state lives in URL
  query params
- **Ingest pipeline** (`scripts/`) — downloads images, processes them with sharp into AVIF + WebP at
  two widths, precomputes label contrast, and validates the catalog with zod

Full detail in the [implementation plan](./edc-catalog-app-implementation-plan.md); the reasoning
behind each choice is in [`docs/decisions.md`](./docs/decisions.md).

## Project layout

_(pending — Phase 1)_

```
app/          Vue components, pages, composables, utils, types   (pending)
scripts/      ingest pipeline                                    (pending)
data/         seed list + per-pack research capture              (pending)
docs/         decision log and working notes
.claude/      subagent definitions
```

## Data

_(pending — Phase 5)_

Prices and review scores are **point-in-time snapshots**, each stamped with `capturedAt`. Nothing in
this catalog is live pricing. Review scores keep their source's own scale rather than being
normalized on write.

## Development

_(pending — Phase 3)_

See [`CLAUDE.md`](./CLAUDE.md) for the version ceilings and project invariants. The one most likely
to catch you out: **TypeScript is capped at 6.0.3** — TS 7 dropped the compiler API that `vue-tsc`
needs to type-check `.vue` files.

## Testing

_(pending — Phase 7)_

## License and content

Code is this repository's own. **Product images and product data are not** — photos come from brand
and retailer sites and remain their owners' property. That is why images are gitignored rather than
committed, and why this catalog is intended for local use rather than public deployment.
