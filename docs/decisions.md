# Decision log

Append-only. Add a new entry rather than rewriting an old one; if a decision is reversed, add a new
entry that supersedes it and mark the original `Superseded by ADR-NNN`.

Entries are short on purpose. `CLAUDE.md` carries the rules an agent must always follow; this file
carries **why** those rules exist, for when someone is deciding whether to change one.

All entries dated 2026-08-31 were made during initial planning, before any code existed.

---

## ADR-001 — Nuxt 4, not Nuxt 3
**2026-08-31 · Accepted**

The original spec named Nuxt 3. Current stable is Nuxt 4.5.2.

**Why:** Same Vue 3.5 core and the actively maintained line; nothing in the spec depended on Nuxt 3.
**Consequence:** Source lives under `app/`. Root-level `pages/` or `components/` directories are wrong.

## ADR-002 — TypeScript capped at 6.0.3
**2026-08-31 · Accepted**

npm `latest` is TypeScript 7.x. We pin 6.0.3 and do not move.

**Why:** TS 7.0 shipped without the programmatic compiler API that `@vue/compiler-sfc` and `vue-tsc`
require to parse and type-check `.vue` SFCs. On TS 7, SFC type-checking does not work at all. TS 6.0
is the final JS-based compiler and the designated 5.9 → 7.0 bridge.
**Consequence:** Never run `typescript@latest`. `tsconfig.json` sets `"ignoreDeprecations": "6.0"`;
clearing those deprecation warnings *is* the eventual 7.1 migration.
**Revisit when:** TS 7.1 restores the compiler API and `vue-tsc` declares support.

## ADR-003 — Vite is not a direct dependency
**2026-08-31 · Accepted**

**Why:** `@nuxt/vite-builder` owns the Vite version (currently `^8.2.0`). Declaring it separately
only creates the opportunity for a resolution conflict.
**Consequence:** `vite` never appears in `package.json`.

## ADR-004 — No state management library
**2026-08-31 · Accepted**

No Pinia, no `useState` for catalog data.

**Why:** The catalog is a build-time JSON import — there is no async data lifecycle to manage. The
only genuine state is search/filter/sort, and putting it in URL query params makes filtered views
bookmarkable and reload-safe, which a store does not.
**Consequence:** Filter state lives in `app/composables/useCatalogFilters.ts` backed by
`useRoute`/`useRouter`. Carousel index is local `ref` state per card.

## ADR-005 — sharp at ingest, not @nuxt/image
**2026-08-31 · Accepted**

**Why:** `@nuxt/image` optimizes at request time behind IPX. Our images are static, finite, and known
at build. Doing the work once in the ingest script and emitting plain `<img srcset>` removes a
module, a runtime dependency, and a class of dev/prod divergence.
**Consequence:** Ingest emits AVIF + WebP at 640w and 1280w. Components use plain `<img>` with
intrinsic `width`/`height` (which is also what keeps CLS at zero).

## ADR-006 — Label contrast precomputed, with a scrim fallback
**2026-08-31 · Accepted**

**Why:** Runtime canvas sampling costs work on every page load and can flash the wrong color before
it resolves. Images are local and static, so the answer never changes — compute it once. Neither
pure white nor pure black clears WCAG AA on some busy product photos, hence the scrim.
**Consequence:** Ingest writes `labelColor` and `needsScrim` per image. Components never sample a
canvas. The math is mirrored in `app/utils/contrast.ts` to stay unit-testable.

## ADR-007 — No backend, and therefore no backend agent
**2026-08-31 · Accepted**

**Why:** This is a local-only `nuxt generate` build. No API routes, no database, no server at runtime.
The work that would conventionally be "backend" here is the build-time ingest pipeline.
**Consequence:** The original `backend-specialist` (Node/Express/REST/DB) was retargeted as
`data-pipeline-specialist`; the original was archived to `~/Downloads/backend-specialist.md` for a
future project. Do not add API routes or an API section to project docs.

## ADR-008 — Scope cut to 20 packs, 1–5 images each
**2026-08-31 · Accepted**

Original ask was 100 packs with 3–9 images each (up to 900 images).

**Why:** Research and image collection is by far the largest cost and the least reversible. Twenty
packs proves the whole pipeline at roughly a fifth of the effort.
**Consequence:** Pack count is data, not code — reaching 100 later is an ingest job with no code
change. Rank is stored per pack rather than derived from array position.

## ADR-009 — Real researched data and real product images
**2026-08-31 · Accepted**

No synthetic or AI-generated placeholder imagery.

**Why:** Explicit product requirement; the catalog is meant to be genuinely useful.
**Consequence:** Prices and review scores are point-in-time snapshots and carry `capturedAt`; the UI
must never imply live pricing. Real photos are copyrighted — see ADR-012. The ingest fetcher must
respect `robots.txt`, rate-limit, and fall back (brand-direct → major retailer → manual capture)
rather than retrying a blocked host.

## ADR-010 — Review scores keep their source scale
**2026-08-31 · Accepted**

Sources disagree: retailers use 5.0, enthusiast sites use 10.0.

**Why:** Normalizing on write destroys the display requirement (`4.4/5.0` vs `8.1/10.0`). Normalizing
on read preserves both.
**Consequence:** Store `score` and `scale` as found. Display raw; **sort and filter on
`score / scale`**. This is the easiest bug in the project to introduce.

## ADR-011 — Rigid 6-cell colorway grid
**2026-08-31 · Accepted**

3 columns × 2 rows. Under 6 colorways: ghost-pad. Over 6: five swatches plus a `+N` badge.

**Why:** Card geometry must be identical across every card or the grid looks broken. A flexible grid
would use space better but would misalign card bottoms.
**Consequence:** 3×2 was chosen over 2×3 because the bottom-left region is wide and short. One class
change if that reads wrong in practice.

## ADR-012 — Public repository; product images decision deferred
**2026-08-31 · Open**

Repo is public at `davidgardner11/edc-catalog-claude`.

**Why:** Owner's explicit choice. Fine for plan and code as they stand.
**Open question:** Whether processed product photos under `public/images/` should be committed at
all, since they come from brand and retailer CDNs and are copyrighted. `.gitignore` carries a
commented-out `public/images/` entry for exactly this.
**Decide before:** the first full ingest run (plan Phase 5).

## ADR-013 — Detail view is a route, not a modal
**2026-08-31 · Accepted**

**Why:** `/pack/[slug]` prerenders with the static build, is linkable and shareable, and is simpler
than a modal layered over the grid. Image clicks are reserved for the carousel, so the card needed a
separate affordance regardless.
**Consequence:** Modal-over-route remains an easy later upgrade if the navigation feels heavy.

## ADR-014 — Generated artifacts are never hand-edited
**2026-08-31 · Accepted**

**Why:** `app/data/catalog.json` and `public/images/` are build products of `pnpm ingest`. Editing
them directly means the next ingest silently reverts the change.
**Consequence:** Content changes go to `data/seed.ts` or `data/sources/{slug}.json`, then re-run.
Originals cache in gitignored `.ingest-cache/` so image processing can be retuned without re-fetching
from any retailer. `pnpm ingest` on unchanged inputs must produce byte-identical output.
