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
clearing those warnings — `baseUrl`, `moduleResolution: node`, `outFile`, ES5 target — *is* the
eventual 7.1 migration.
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
**Scope:** This governs **catalog content only.** Development fixtures may use placeholder images —
they never ship in `catalog.json` and exist so components can be built before research happens.
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
**2026-08-31 · Superseded by ADR-015**

3 columns × 2 rows. Under 6 colorways: ghost-pad. Over 6: five swatches plus a `+N` badge.

**Why:** Card geometry must be identical across every card or the grid looks broken. A flexible grid
would use space better but would misalign card bottoms.
**Superseded because:** a `+N` badge shows a count but gives no way to *see* the remaining colorways.
ADR-015 replaces it with a paged grid that makes every colorway reachable.

## ADR-012 — Public repository; product images are not committed
**2026-08-31 · Accepted**

Repo is public at `davidgardner11/edc-catalog-claude`. `public/images/` is gitignored.

**Why:** Public visibility was the owner's explicit choice. Committing photos sourced from brand and
retailer CDNs would make the repository redistribute copyrighted material, and ~100 binaries in git
history are removable only by a force-push rewrite.
**Consequence:** A fresh clone renders nothing until `pnpm ingest` runs. This adds no new workflow —
`app/data/catalog.json` is already generated (ADR-014), so ingest was always a required setup step.
The README must say so.

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

## ADR-015 — Paged 4×2 colorway grid
**2026-08-31 · Accepted · supersedes ADR-011**

8 cells, 4 columns × 2 rows.

- **≤ 8 colorways:** all shown. No pager. Ghost-pad any unused cells.
- **> 8 colorways:** cell 8 becomes a clickable `>` pager. Each page shows 7 colorways plus the
  pager, so page count is `ceil(n / 7)`.
- The pager **wraps**: `>` on the last page returns to the first, exactly like the image carousel
  (ADR-016 records why that consistency matters).

**Why:** A `+N` badge reported a count without making the colorways reachable. Paging makes every
colorway viewable while keeping card geometry rigidly identical, which is the constraint that
survives from ADR-011.

**Consequences:**
- The pager always occupies **cell 8**, even on a partial final page (a 9-colorway pack shows two
  colorways, five ghost cells, then `>`). A control that moves is harder to hit and reads as a
  different control.
- Colorway paging is a **third** click interaction on the card, after carousel prev/next. Its
  handler must `stopPropagation` so it neither advances the carousel nor triggers card-body
  navigation to the detail route.
- Page index is local `ref` state per card, resetting on unmount — same treatment as carousel index
  (ADR-004).
- `>` is a real `<button>` with an `aria-label` naming the destination page, and page changes are
  announced via `aria-live`.

## ADR-016 — Wrap-around is the card's single interaction idiom
**2026-08-31 · Accepted**

Both cyclable controls on a card wrap rather than dead-ending: the image carousel (last → first,
first → last) and the colorway pager (last page → first page).

**Why:** One learned behavior covers every control on the card. A user who discovers that images
cycle can predict what the colorway pager does without trying it.
**Consequence:** No control is ever rendered disabled, so no card needs a disabled visual state.
Implement with modulo arithmetic, never bounds-clamping.

## ADR-017 — Price is the lowest of 2–3 compared retailers
**2026-08-31 · Accepted**

Per pack, check brand-direct plus one or two major retailers and store the minimum, with the
retailer that offered it.

**Why:** The card labels this figure "lowest available price." Recording a single findable price and
calling it "lowest" would be an unverified claim. Comparing a small set makes the label true.
**Consequences:**
- Roughly triples Phase 5 research time versus single-source capture. Accepted deliberately; the
  20-pack scope cut (ADR-008) leaves room for it.
- `capturedAt` remains mandatory (ADR-009) — "lowest" is true as of that timestamp, never live.
- The data model stores the winning price and retailer. If per-retailer comparison later needs to be
  visible in the detail view, that is a schema change and a new ADR.

## ADR-018 — Ranking blends acclaim with channel-relative review counts
**2026-08-31 · Accepted (low confidence — see coverage)**

Ranking is `0.6 × acclaim + 0.4 × popularity`, where acclaim is the cross-source critical ranking
(Carryology, Pack Hacker, HiConsumption, Nomads Nation) and popularity is a review-count tier.

**Why tiers, not raw counts:** counts are not comparable across distribution models. Most acclaimed
EDC brands are direct-to-consumer, so their only review pool is their own site; mass-market packs
sell through REI/Amazon. Tom Bihn's 395 is on its *sole* channel; Mystery Ranch's 10 is on *one of
many*. Ranking those against each other measures distribution model, not popularity. DTC brand sites
are also moderated and cluster near 4.9 against REI's 4.5–4.7. Packs are therefore tiered 1–5
**within their own channel**, and tiers — not counts — enter the blend.

**Guards:**
- Counts below 50 are treated as *insufficient evidence*, not as unpopularity. Otherwise Mystery
  Ranch would drop six places on 10 REI reviews while also selling through channels we never checked.
- A pack with no retrievable count scores its acclaim value, so the blend is neutral rather than
  penalising packs that merely hide their numbers.

**Coverage — the material weakness:** only **6 of 20** packs yielded a usable count. REI product
pages time out on direct fetch (counts arrived only when a search snippet happened to include them),
GORUCK publishes no on-page count, Evergoods renders reviews in a Loox iframe, and Aer, Bellroy,
Black Ember and Chrome render theirs dynamically.

**Outcome:** membership did **not** change — no pack entered or left. Only WANDRD PRVKE 21 moved
meaningfully (15 → 11, on 3,031 reviews). The earlier expectation in this ADR that reweighting would
change membership was wrong; it cannot, when 14 of 20 packs fall back to acclaim-only.

**Open data issue:** Black Ember Citadel R2 (rank 10) appears discontinued — the line has moved to
Citadel R3 / H2. This blocks Phase 5 for that pack independently of review counts, and needs its own
ADR: substitute the current model, or drop the brand. Phase 5 should confirm each pack is still in
production before spending research effort on it.

**To strengthen:** supply counts manually from a browser (these sites do not block a human) and
re-run the blend. Until then this ordering is acclaim with a light popularity nudge, and should be
described that way rather than as a popularity ranking.

## ADR-019 — Black Ember Citadel R2 is discontinued
**2026-08-31 · Open**

Rank 10 is Black Ember Citadel R2. The model no longer appears on `blackember.com`; the line has
moved to Citadel R3 and Citadel H2.

**Why this blocks work:** a discontinued product has no live price, no current colorways, and no
first-party product images — so Phase 5 cannot research it regardless of ADR-018's review-count gap.

**Options:**
1. Substitute the current model (Citadel R3 or H2), keeping Black Ember on the list at rank 10. The
   acclaim ranking was earned by the R2, so this inherits a rank the new model has not been reviewed
   into.
2. Drop Black Ember and promote the next candidate, leaving 19 brands across 20 slots unchanged.

**Decide before:** Phase 5 reaches rank 10. The ranked-20 table carries a ⚠️ marker until then.

**Generalisation:** Phase 5 must confirm each pack is still in production *before* researching it.
Other entries may have the same problem — Incase ICON Slim and Arktype Dashpack II are the most
likely, being older models from smaller brands.
