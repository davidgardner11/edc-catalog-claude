# EDC Backpack Catalog — Implementation Plan

## Context

There is no code yet — `/Users/davidgardner/Code/davidgardner11/edc-catalog-claude` is empty. We are
building a local-only, statically-generated web catalog of acclaimed Everyday Carry backpacks,
presented as playing-card-shaped cards (5:7 portrait) in a browsable, filterable grid.

Scope was deliberately cut from the original ask during clarification: **20 packs, not 100**, and
**1–5 real product images per pack, not 3–9**. Data and images are real (researched from the web and
downloaded locally), not generated or synthetic. Everything above 20 is a later batch — the code
treats the count as data, so growing to 100 is a data job, not a code change.

The interesting engineering is not the grid. It is three things: an **ingest pipeline** that turns
research into typed, optimized, build-time assets; a **precomputed contrast decision** so the label
over each photo picks white or black without runtime work; and a **carousel whose label never moves
or re-renders** while the image beneath it cycles.

---

## Decisions

Locked in from clarification:

| Area | Decision |
| --- | --- |
| Data | Real, researched via web search. `capturedAt` stamped on every price/score. |
| Images | Real product photos, downloaded and committed. Max 5, min 1 per pack. |
| Swatches | Rigid 6-cell grid. Under 6 → ghost cells. Over 6 → 5 swatches + `+N` badge. |
| Contrast | Precomputed at ingest via sharp, **plus** a scrim fallback when neither color clears AA. |
| Image tech | sharp at ingest → AVIF + WebP at 640w/1280w → plain `<img srcset>`. No `@nuxt/image`, no IPX. |
| Shell | Search + filter + sort, responsive ranked grid, card detail view. |

Answering the two questions you left open:

- **Image delivery** — `@nuxt/image` is not worth it here. It exists to optimize images at request
  time behind IPX; our images are static, known at build, and finite (≤100 files). Doing the work
  once in the ingest script with sharp and emitting plain `<img srcset>` removes a module, a runtime
  dependency, and a whole class of dev/prod divergence. Confirmed by your answer.
- **State & data** — **no store at all.** The catalog is a static JSON imported at build time, so
  there is no async data lifecycle to manage. The only real state is filter/search/sort, and that
  lives in a single composable backed by **URL query params** (`useRoute`/`useRouter`). Result:
  filtered views are bookmarkable and survive reload, and Pinia/`useState` are unnecessary. Carousel
  index is local `ref` state inside each card — it is per-card and nobody else needs it.

Calls I made that are one-line reversals if you disagree:

- **Version drift.** You specified Nuxt 3; current is **Nuxt 4.5.2**. Same Vue 3.5 core, actively
  maintained, `app/` as the default source dir. Planning on Nuxt 4.
- **"2x3 grid"** is ambiguous — 2 cols × 3 rows, or 3 × 2? The bottom-left div is wide and short, so
  **3 columns × 2 rows** fits far better. One class flip if you meant the other.
- **Detail view is a real route** (`/pack/[slug]`), prerendered and linkable, rather than a modal.
  Simpler, shareable, SSG-friendly. Modal-over-route is an easy later upgrade.

---

## Stack

```
nuxt          4.5.2     SSG via `nuxt generate`. Requires Node ^22.19 || ^24.11 || >=26 (local: 24.19 ✓)
vue           3.5.42    newest stable — see below
vite          8.2.2     NOT declared in package.json; @nuxt/vite-builder@4.5.2 pins vite ^8.2.0
typescript    6.0.3     hard ceiling — see below
tailwindcss   4.3.3     via @tailwindcss/vite — CSS-first config, no tailwind.config.js
sharp         0.35.4    ingest-time only (devDependency)
zod           ^4        validates catalog.json at build; fails loudly on bad data
vitest                  unit tests for pure logic
@playwright/test        E2E, via the playwright-tester skill
```

**Version rationale** (checked against npm `dist-tags`, not assumed):

- **Vue 3.5.42 is already the newest stable.** There is no Vue 4. Vue 3.6 exists only as `rc.6`, and
  Nuxt 4.5.2 declares `vue: ^3.5.40`. Nothing to gain by moving.
- **Vite is not a direct dependency.** Nuxt owns it through `@nuxt/vite-builder`. Declaring it in
  `package.json` only creates the opportunity for a version conflict.
- **TypeScript must stay on the 6.x line.** npm `latest` is 7.0.2 and it is a real stable release,
  but TS 7.0 shipped *without* the programmatic compiler API, which `@vue/compiler-sfc` and `vue-tsc`
  require to parse and type-check `.vue` SFCs. Vue SFC type-checking therefore cannot run on TS 7 at
  all until the API returns in 7.1. **6.0.3** — the final JS-based compiler, stable since March 2026
  and explicitly designed as the 5.9 → 7.0 bridge — is the correct ceiling. Set
  `"ignoreDeprecations": "6.0"` in `tsconfig.json` and resolve deprecation warnings (`baseUrl`,
  `moduleResolution: node`, `outFile`) as they appear; that work *is* the 7.1 migration.
- **Tailwind 4.3.3 is current.** v4 is CSS-first: no `tailwind.config.js`, theme tokens declared with
  `@theme` inside `main.css`.

`nuxt.config.ts` per the [official Tailwind/Nuxt guide](https://tailwindcss.com/docs/installation/framework-guides/nuxt):
`@tailwindcss/vite` in `vite.plugins`, `@import "tailwindcss";` in `app/assets/css/main.css`,
that file listed in `css:`. Prerender everything: `nitro.prerender.crawlLinks = true`.

---

## Data model

`app/types/backpack.ts` — the contract everything else is written against.

```ts
export type Colorway = { name: string; hex: string; family: ColorFamily }

export type CarouselImage = {
  base: string              // "/images/aer-travel-pack-3/2"
  width: number             // intrinsic, for CLS-free layout
  height: number
  alt: string
  labelColor: 'white' | 'black'   // precomputed
  needsScrim: boolean             // precomputed; true when winner < 4.5:1
}

export type Backpack = {
  rank: number              // 1..20
  slug: string
  name: string
  brand: string
  images: CarouselImage[]         // 1..5, ordered; [0] is primary
  colorways: Colorway[]           // 0..N; grid renders 6 cells
  price: { amountUsd: number; retailer: string; url: string; capturedAt: string }
  review: { score: number; scale: number; source: string; url: string; capturedAt: string }
  specs?: { capacityLiters?: number; weightGrams?: number; dimensions?: string; material?: string }
}
```

`scale` is stored per pack because sources disagree (REI 5.0, Carryology 10.0). Display uses raw
`score`/`scale`; **sorting and filtering use `score / scale`** normalized to 0–1. Conflating those
is the easy bug here.

---

## The ranked 20 (approved before ingest)

Assembled from cross-source consensus rather than any single list: Carryology Carry Awards, Pack
Hacker brand flagships, HiConsumption's ranked 15, and the Nomads Nation tier list. Rationale below
gets committed alongside each entry in `data/seed.ts` so the ordering is auditable.

| # | Brand | Model | Basis |
| --- | --- | --- | --- |
| 1 | EVERGOODS | Civic Panel Loader 24L V3 | Carry Awards IX champion; repeatedly named best EDC pack made |
| 2 | Peak Design | Everyday Backpack V2 30L | Carryology award; MagLatch; most recognizable EDC pack |
| 3 | GORUCK | GR1 26L | Cult status, lifetime guarantee, "toughest pack" across lists |
| 4 | Aer | Travel Pack 3 | "One of the most beloved EDC go-anywhere packs ever" |
| 5 | Aer | City Pack Pro 2 | S-tier; zero-regret daily driver |
| 6 | Tom Bihn | Synapse 19 | Long-running cult classic, US-made |
| 7 | Bellroy | Classic Backpack Plus | Best-selling gateway EDC pack |
| 8 | Mystery Ranch | Urban Assault 24 | The 3-Zip design icon |
| 9 | Black Ember | Citadel R2 | Best weatherproof; modular hardshell |
| 10 | Able Carry | Max EDC 26L | Enthusiast darling, Carry Awards regular |
| 11 | Mission Workshop | The Rhake VX | Best commuter/cycling; weatherproof VX |
| 12 | Alpaka | Elements Backpack Pro | Best modern value |
| 13 | Topo Designs | Rover Pack Tech | Heritage design, accessible price |
| 14 | Osprey | Daylite Plus 20L | Highest-volume seller on the list |
| 15 | WANDRD | PRVKE 21 | Photo/EDC crossover standard |
| 16 | The Brown Buffalo | ConcealPack 21L | Best small-batch |
| 17 | Incase | ICON Slim | Long-standing tech-EDC staple |
| 18 | Chrome Industries | Barrage Cargo | Messenger heritage, weatherproof roll-top |
| 19 | Arktype | Dashpack II | Minimalist favorite |
| 20 | Filson | Dryden Ballistic Nylon | Heritage/professional entry |

Spread: **$60–$435**, **14–30L**, 19 distinct brands. Aer appears twice, which is defensible given
it is the most consistently acclaimed EDC brand, but #5 is the natural swap slot if you want 20/20
brand diversity.

---

## Ingest pipeline

Research is mine (WebSearch/WebFetch); the scripts are deterministic and re-runnable. Split so a
failure in one pack never forces a full re-fetch.

```
data/seed.ts              hand-curated ranked 20: slug, name, brand, brand URL
data/sources/{slug}.json  research output: image URLs, price+retailer+url, score+scale+source, specs
scripts/fetch-images.ts   download ≤5 images → .ingest-cache/{slug}/  (gitignored, rate-limited)
scripts/process-images.ts sharp → public/images/{slug}/{n}.{avif,webp} at 640w + 1280w
scripts/analyze-label.ts  sharp → labelColor + needsScrim per image
scripts/build-catalog.ts  merge + zod validate → app/data/catalog.json
```

Orchestrated by `pnpm ingest`. `.ingest-cache/` holds originals so image processing can be re-tuned
without re-hitting any retailer.

**Contrast math** (`scripts/analyze-label.ts`, mirrored in a pure `app/utils/contrast.ts` for tests):

1. Crop only the **label's bounding box** — not the whole image. The label sits in the lower-left of
   the top 65% region; sample exactly that rect.
2. Linearize sRGB, compute WCAG relative luminance `L = 0.2126R + 0.7152G + 0.0722B`.
3. `contrast(a, b) = (Lmax + 0.05) / (Lmin + 0.05)`; pick whichever of white/black scores higher.
4. If the winner is still `< 4.5`, set `needsScrim: true` — the card renders a bottom-up
   `linear-gradient` scrim behind the label. This is what saves busy product photos where neither
   pure color is legible.

---

## Components

```
app/pages/index.vue              toolbar + grid
app/pages/pack/[slug].vue        detail route, prerendered
app/components/BackpackCard.vue  5:7 shell, grid-rows-[65fr_35fr]
app/components/CardCarousel.vue  image swap, click zones, dots
app/components/CardLabel.vue     name + brand, absolutely positioned, pointer-events-none
app/components/ColorwayGrid.vue  rigid 6 cells, ghost padding, +N badge
app/components/PriceBlock.vue    $249 bold / retailer beneath
app/components/ScoreBlock.vue    4.4/5.0
app/components/CatalogToolbar.vue
app/composables/useCatalogFilters.ts   URL-query-backed filter/sort state
app/utils/{contrast,format,color}.ts   pure, unit-tested
```

**Card geometry.** `aspect-[5/7] min-w-[260px] max-w-[320px] rounded-xl border shadow-sm
overflow-hidden`, inner `grid grid-rows-[65fr_35fr]`. Using fractional grid rows rather than
percentage heights is what makes the 65/35 split exact and immune to content pushing it around.

**Carousel.** Two full-height `<button>` zones (left/right halves) layered *above* the label, which
is `pointer-events-none` — so a click anywhere in the image region, label included, cycles. Wrap is
plain modulo: `(i + 1) % n` and `(i - 1 + n) % n`. The label is a **sibling** of the `<img>`, never
keyed to the image index, so it cannot move or re-render when the image swaps — that is the
requirement, enforced structurally rather than by hoping. Image `[0]` eager, rest lazy, neighbors
preloaded on first interaction to avoid a swap flash. `aria-label`s on both zones, ArrowLeft/Right
on the container, dot indicators, and an `aria-live` "Image 3 of 5".

**Swatches.** `grid grid-cols-3 grid-rows-2 gap-1`, always 6 cells rendered. `colorways.slice(0, 5)`
plus a `+N` cell when `length > 6`; ghost cells (dashed, muted) fill the remainder when under.
Geometry is therefore identical on all 20 cards.

**Formatting.** Score `${score.toFixed(1)}/${scale.toFixed(1)}` → `4.4/5.0`, `8.1/10.0`. Price via
`Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`, dropping `.00` when whole.

---

## Build order

1. **Scaffold** — Nuxt 4 + Tailwind 4 + TS, `pnpm dev` renders a blank page.
2. **Types + fixtures** — `app/types/backpack.ts` and 3 hand-written fixture packs with placeholder
   images, so components can be built and tested before any research happens.
3. **Card components** — build the whole card against fixtures. This is where the 65/35 split,
   carousel wraparound, fixed label, and swatch grid get nailed down.
4. **Ingest pipeline** — scripts + zod schema, proven end-to-end on 3 real packs.
5. **Research + ingest 20** — the slow part, run in batches of ~5. Now cheap to verify, because the
   UI already exists.
6. **Catalog shell** — toolbar, filters, sort, detail route.
7. **Tests + verification.**

Steps 1–4 are the ones worth your review; step 5 is mechanical once the pipeline is proven.

---

## Verification

**Unit (`vitest`)** — the pure logic, which is where the real bugs live:
`contrast.ts` (known-luminance fixtures: pure white bg → black label, pure black → white, mid-gray →
`needsScrim`), score formatter across both scales, price formatter, carousel modulo wraparound at
both ends with n=1 and n=5, swatch padding/overflow at counts 0/3/6/9.

**E2E (`playwright-tester` skill)** — the behaviors that are only observable in a browser:
- card bounding box matches 5:7 within tolerance; image region is 65% of card height
- clicking the right half advances; from the last image it lands on the first
- clicking the left half retreats; from the first image it lands on the last
- **label text and bounding-box position are byte-identical across all N images** (the core spec)
- exactly 6 swatch cells on every card, whatever the colorway count
- rendered score matches `/^\d+\.\d\/\d+\.\d$/`

**Manual / build:**
- `pnpm dev` → grid of 20 cards, exercise filters and sort, confirm URL query updates and a reload
  restores the same view
- `pnpm generate && npx serve .output/public` → confirm SSG output is fully static, `/pack/{slug}`
  routes prerendered, label colors correct in raw HTML with JS disabled
- Lighthouse on the grid; watch CLS specifically, since intrinsic `width`/`height` on every `<img>`
  is what keeps it at zero

---

## Risks

- **Image licensing.** Product photos are copyrighted. Downloading them for a local-only personal
  catalog is low-risk, but this should not be publicly deployed without permission. The fetcher will
  respect `robots.txt` and rate-limit. Worth a note in the README.
- **Retailer blocking.** Amazon in particular blocks automated fetches. Fallback order is
  brand-direct → REI/Huckberry/Backcountry → manual URL capture into `data/sources/{slug}.json`.
  This is why source URLs are data, not hardcoded scraping logic.
- **Stale prices/scores.** Point-in-time by nature. `capturedAt` is stored and surfaced in the detail
  view so the catalog never implies live pricing.
- **Ranking is subjective.** Addressed by approving the list above before any ingest runs, and by
  committing the per-pack rationale into `data/seed.ts` so the ordering stays auditable.
- **TypeScript 7.1 is a scheduled follow-up**, not a surprise. When the compiler API returns and
  `vue-tsc` supports it, the upgrade is: clear remaining 6.0 deprecation warnings, drop
  `ignoreDeprecations`, bump. Nothing in this plan's design blocks it.
