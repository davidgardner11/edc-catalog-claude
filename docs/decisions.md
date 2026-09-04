# Decision log

Append-only. Add a new entry rather than rewriting an old one; if a decision is reversed, add a new entry that supersedes it and mark the original `Superseded by ADR-NNN`.

Entries are short on purpose. `CLAUDE.md` carries the rules an agent must always follow; this file carries **why** those rules exist, for when someone is deciding whether to change one.

All entries dated 2026-08-31 were made during initial planning, before any code existed.

---

## ADR-001 — Nuxt 4, not Nuxt 3
**2026-08-31 · Accepted**

The original spec named Nuxt 3. Current stable is Nuxt 4.5.2.

**Why:** Same Vue 3.5 core and the actively maintained line; nothing in the spec depended on Nuxt 3. **Consequence:** Source lives under `app/`. Root-level `pages/` or `components/` directories are wrong.

## ADR-002 — TypeScript capped at 6.0.3
**2026-08-31 · Accepted**

npm `latest` is TypeScript 7.x. We pin 6.0.3 and do not move.

**Why:** TS 7.0 shipped without the programmatic compiler API that `@vue/compiler-sfc` and `vue-tsc` require to parse and type-check `.vue` SFCs. On TS 7, SFC type-checking does not work at all. TS 6.0 is the final JS-based compiler and the designated 5.9 → 7.0 bridge. **Consequence:** Never run `typescript@latest`. `tsconfig.json` sets `"ignoreDeprecations": "6.0"`; clearing those warnings — `baseUrl`, `moduleResolution: node`, `outFile`, ES5 target — *is* the eventual 7.1 migration. **Revisit when:** TS 7.1 restores the compiler API and `vue-tsc` declares support.

## ADR-003 — Vite is not a direct dependency
**2026-08-31 · Accepted**

**Why:** `@nuxt/vite-builder` owns the Vite version (currently `^8.2.0`). Declaring it separately only creates the opportunity for a resolution conflict. **Consequence:** `vite` never appears in `package.json`.

## ADR-004 — No state management library
**2026-08-31 · Accepted**

No Pinia, no `useState` for catalog data.

**Why:** The catalog is a build-time JSON import — there is no async data lifecycle to manage. The only genuine state is search/filter/sort, and putting it in URL query params makes filtered views bookmarkable and reload-safe, which a store does not. **Consequence:** Filter state lives in `app/composables/useCatalogFilters.ts` backed by `useRoute`/`useRouter`. Carousel index is local `ref` state per card.

## ADR-005 — sharp at ingest, not @nuxt/image
**2026-08-31 · Accepted**

**Why:** `@nuxt/image` optimizes at request time behind IPX. Our images are static, finite, and known at build. Doing the work once in the ingest script and emitting plain `<img srcset>` removes a module, a runtime dependency, and a class of dev/prod divergence. **Consequence:** Ingest emits AVIF + WebP at 640w and 1280w. Components use plain `<img>` with intrinsic `width`/`height` (which is also what keeps CLS at zero).

## ADR-007 — No backend, and therefore no backend agent
**2026-08-31 · Accepted**

**Why:** This is a local-only `nuxt generate` build. No API routes, no database, no server at runtime. The work that would conventionally be "backend" here is the build-time ingest pipeline. **Consequence:** The original `backend-specialist` (Node/Express/REST/DB) was retargeted as `data-pipeline-specialist`; the original was archived to `~/Downloads/backend-specialist.md` for a future project. Do not add API routes or an API section to project docs.

## ADR-008 — Scope cut to 20 packs, 1–5 images each
**2026-08-31 · Accepted**

Original ask was 100 packs with 3–9 images each (up to 900 images).

**Why:** Research and image collection is by far the largest cost and the least reversible. Twenty packs proves the whole pipeline at roughly a fifth of the effort. **Consequence:** Pack count is data, not code — reaching 100 later is an ingest job with no code change. Rank is stored per pack rather than derived from array position.

## ADR-009 — Real researched data and real product images
**2026-08-31 · Accepted**

No synthetic or AI-generated placeholder imagery.

**Why:** Explicit product requirement; the catalog is meant to be genuinely useful. **Scope:** This governs **catalog content only.** Development fixtures may use placeholder images — they never ship in `catalog.json` and exist so components can be built before research happens. **Consequence:** Prices and review scores are point-in-time snapshots and carry `capturedAt`; the UI must never imply live pricing. Real photos are copyrighted — see ADR-012. The ingest fetcher must respect `robots.txt`, rate-limit, and fall back (brand-direct → major retailer → manual capture) rather than retrying a blocked host.

## ADR-010 — Review scores keep their source scale
**2026-08-31 · Accepted**

Sources disagree: retailers use 5.0, enthusiast sites use 10.0.

**Why:** Normalizing on write destroys the display requirement (`4.4/5.0` vs `8.1/10.0`). Normalizing on read preserves both. **Consequence:** Store `score` and `scale` as found. Display raw; **sort and filter on `score / scale`**. This is the easiest bug in the project to introduce.

## ADR-011 — Rigid 6-cell colorway grid
**2026-08-31 · Superseded by ADR-015**

3 columns × 2 rows. Under 6 colorways: ghost-pad. Over 6: five swatches plus a `+N` badge.

**Why:** Card geometry must be identical across every card or the grid looks broken. A flexible grid would use space better but would misalign card bottoms. **Superseded because:** a `+N` badge shows a count but gives no way to *see* the remaining colorways. ADR-015 replaces it with a paged grid that makes every colorway reachable.

## ADR-012 — Public repository; product images are not committed
**2026-08-31 · Accepted**

Repo is public at `davidgardner11/edc-catalog-claude`. `public/images/` is gitignored.

**Why:** Public visibility was the owner's explicit choice. Committing photos sourced from brand and retailer CDNs would make the repository redistribute copyrighted material, and ~100 binaries in git history are removable only by a force-push rewrite. **Consequence:** A fresh clone renders nothing until `pnpm ingest` runs. This adds no new workflow — `app/data/catalog.json` is already generated (ADR-014), so ingest was always a required setup step. The README must say so.

## ADR-013 — Detail view is a route, not a modal
**2026-08-31 · Accepted**

**Why:** `/pack/[slug]` prerenders with the static build, is linkable and shareable, and is simpler than a modal layered over the grid. Image clicks are reserved for the carousel, so the card needed a separate affordance regardless. **Consequence:** Modal-over-route remains an easy later upgrade if the navigation feels heavy.

## ADR-014 — Generated artifacts are never hand-edited
**2026-08-31 · Accepted**

**Why:** `app/data/catalog.json` and `public/images/` are build products of `pnpm ingest`. Editing them directly means the next ingest silently reverts the change. **Consequence:** Content changes go to `data/seed.ts` or `data/sources/{slug}.json`, then re-run. Originals cache in gitignored `.ingest-cache/` so image processing can be retuned without re-fetching from any retailer. `pnpm ingest` on unchanged inputs must produce byte-identical output.

## ADR-015 — Paged 4×2 colorway grid
**2026-08-31 · Accepted · supersedes ADR-011**

8 cells, 4 columns × 2 rows.

- **≤ 8 colorways:** all shown. No pager. Ghost-pad any unused cells.
- **> 8 colorways:** cell 8 becomes a clickable `>` pager. Each page shows 7 colorways plus the pager, so page count is `ceil(n / 7)`.
- The pager **wraps**: `>` on the last page returns to the first, exactly like the image carousel (ADR-016 records why that consistency matters).

**Why:** A `+N` badge reported a count without making the colorways reachable. Paging makes every colorway viewable while keeping card geometry rigidly identical, which is the constraint that survives from ADR-011.

**Consequences:**
- The pager always occupies **cell 8**, even on a partial final page (a 9-colorway pack shows two colorways, five ghost cells, then `>`). A control that moves is harder to hit and reads as a different control.
- Colorway paging is a **third** click interaction on the card, after carousel prev/next. Its handler must `stopPropagation` so it neither advances the carousel nor triggers card-body navigation to the detail route.
- Page index is local `ref` state per card, resetting on unmount — same treatment as carousel index (ADR-004).
- `>` is a real `<button>` with an `aria-label` naming the destination page, and page changes are announced via `aria-live`.

## ADR-016 — Wrap-around is the card's single interaction idiom
**2026-08-31 · Accepted**

Both cyclable controls on a card wrap rather than dead-ending: the image carousel (last → first, first → last) and the colorway pager (last page → first page).

**Why:** One learned behavior covers every control on the card. A user who discovers that images cycle can predict what the colorway pager does without trying it. **Consequence:** No control is ever rendered disabled, so no card needs a disabled visual state. Implement with modulo arithmetic, never bounds-clamping.

## ADR-017 — Price is the lowest of 2–3 compared retailers
**2026-08-31 · Accepted**

Per pack, check brand-direct plus one or two major retailers and store the minimum, with the retailer that offered it.

**Why:** The card labels this figure "lowest available price." Recording a single findable price and calling it "lowest" would be an unverified claim. Comparing a small set makes the label true. **Consequences:**
- Roughly triples Phase 5 research time versus single-source capture. Accepted deliberately; the 20-pack scope cut (ADR-008) leaves room for it.
- `capturedAt` remains mandatory (ADR-009) — "lowest" is true as of that timestamp, never live.
- The data model stores the winning price and retailer. If per-retailer comparison later needs to be visible in the detail view, that is a schema change and a new ADR.

## ADR-018 — Ranking is pure critical acclaim; popularity abandoned
**2026-08-31 · Accepted**

The 20 are ranked on cross-source critical acclaim alone (Carryology, Pack Hacker, HiConsumption, Nomads Nation). There is no popularity term.

**Popularity was investigated and abandoned as impractical to measure.** The attempt and why it failed, so this is not re-litigated:

1. **Retailer review counts are not comparable across distribution models.** Most acclaimed EDC brands are direct-to-consumer, so their only review pool is their own site; mass-market packs sell through REI and Amazon. Tom Bihn's 395 reviews are on its *sole* channel; Mystery Ranch's 10 are on *one of many*. Ranking those against each other measures distribution model, not popularity. DTC brand sites are also moderated and cluster near 4.9 against REI's 4.5–4.7.
2. **A channel-relative tiering scheme fixed the comparability problem but not the coverage one.** Only 6 of 20 packs yielded a usable count: REI product pages time out on automated fetch, GORUCK publishes no on-page count, Evergoods renders reviews in a Loox iframe, and Aer, Bellroy, Black Ember and Chrome render theirs dynamically.
3. **At that coverage the term did nothing.** With 14 of 20 packs falling back to acclaim-only, the blend could reorder slightly but could not change membership. It moved exactly one pack meaningfully. A 0.4 weight standing on 30% coverage is false precision, not a signal.
4. **Units sold — the only true popularity measure — is not public** for any of these brands.

**Decision:** delete the popularity term rather than keep a weight that implies a rigour the data cannot support. The ranking is editorial and says so.

**Consequence:** `rank` in `data/seed.ts` *is* the acclaim rank; there is no separate `acclaimRank`. Each entry carries a `rationale` naming the sources behind its placement, so the ordering stays auditable as judgment rather than arithmetic.

**Not affected:** each pack's **review score** (`4.4/5.0`, `8.1/10.0`) is a card field and stays — see ADR-010. What was dropped is review *count* as a ranking input, not review score as content.

**If revisited:** the blocker is data collection, not method. Counts gathered by hand from a browser (these sites do not block a human) would restore the option, and the channel-relative tiering in the history of this file is the method to reuse.

## ADR-019 — Black Ember Citadel R2 replaced by Citadel R3 25L at rank 10
**2026-08-31 · Accepted**

Black Ember Citadel R2 no longer appears on `blackember.com`. It is replaced by the **Citadel R3 25L**, inheriting the R2's acclaim rank of **9**. (This entry read "rank 10" while the ADR-018 blend was in force; dropping the popularity term restored the acclaim ordering.)

**Why R3 and not H2:** the R3 is the direct successor in the same line — reviewers describe it as an overhaul of the R2 (less stiff fabric, real external pocketing, toned-down modularity). The H2 is a refinement *of the R3* with a half-zip opening and bottle pockets — a sibling variant, not the succession. R3 ships in 20L and 25L; **25L** matches the R2's capacity.

**Why keep the rank:** rank 10 was earned by the R2's critical reception, and the R3 has not been reviewed into that position independently. This is a deliberate inheritance, accepted because the alternative — dropping Black Ember — loses a distinct brand from a 19-brand list. Revisit if R3 coverage suggests it belongs elsewhere.

**Consequences:**
- The ranked-20 table names Citadel R3 25L at rank 9; no ⚠️ marker remains.
- The R2's acclaim placement carries forward, so `data/seed.ts` must note in `rationale` that the rank was inherited rather than earned by this model.
- Any review score captured must come from the **R3**, not from R2 reviews (ADR-009: real data).

**Generalisation that survives:** Phase 5 must confirm each pack is still in production *before* researching it — a discontinued model has no live price, current colorways, or first-party images. Incase ICON Slim and Arktype Dashpack II are the next most likely to have the same problem, being older models from smaller brands. This check is the `research-curator`'s first instruction.

## ADR-020 — Scaffold decisions Phase 1 committed to
**2026-09-02 · Accepted**

Four things the scaffold settled that later phases must not undo.

**`vue-router` is not declared, for the same reason as `vite`.** Nuxt 4.5.2 depends on `vue-router ^5.2.0`. Declaring `"vue-router": "^4.5.1"` in `package.json` — which the first pass did — silently resolved 4.6.4 and downgraded the router out from under Nuxt. ADR-003's rule generalises: if Nuxt already depends on it, do not also declare it. The check is `npm view nuxt@<v> dependencies`, not intuition about what "feels like" a direct dependency.

**`ignoreDeprecations` lives in `nuxt.config.ts`, not only `tsconfig.json`.** Nuxt 4 generates four project-reference tsconfigs (`app`, `server`, `shared`, `node`) under `.nuxt/`, so the root `tsconfig.json` is solution-style — `"files": []` plus `references` — and its `compilerOptions` reach none of them. The flag is therefore set via `typescript.{tsConfig,nodeTsConfig,sharedTsConfig}` and, separately, `nitro.typescript.tsConfig` (Nitro owns `tsconfig.server.json` and does not read the Nuxt-level key). It is *also* repeated in the root config for editors and a bare `tsc`. **Consequence:** verify a compiler flag by grepping the generated `.nuxt/tsconfig.*.json`, never by reading the root file.

**Every command in the table exists on day one.** `pnpm ingest` runs `scripts/ingest.ts`, a stub that prints what is missing and exits 1; `pnpm test` carries `--passWithNoTests`. **Why:** a documented command that fails with "no such file" teaches a reader to distrust the table. A command that explains itself does not. Phases 4 and 7 replace the stub and drop the flag.

**`pnpm typecheck` was added** though it is not in the plan's table — TS 6.0.3 is the riskiest pin here and there was no way to exercise it. It passes with zero errors. It does print `[Vue] Resolve plugin path failed: vue-router/volar/...`: vue-tsc 3.3.11 probes Volar plugin subpaths that vue-router 5 no longer exports. Cosmetic, upstream, no fix available at these versions — judge the run by its exit code.

**Also:** `nuxt generate` leaves a `dist` **symlink** to `.output/public`. `.gitignore` said `dist/`, whose trailing slash does not match a symlink, so it was reported untracked; the entry is now `dist`.

## ADR-021 — Card is three bands (65/15/20); the label moves off the photo
**2026-09-02 · Accepted**

The card was 5:7 split two ways — 65% carousel with the brand/model label **overlaid on the photo**, 35% meta row. It is now split three ways:

| Band | Height | Contents |
| --- | --- | --- |
| 1 | `65fr` | image carousel, unchanged — now completely unobstructed |
| 2 | `15fr` | brand (uppercase, tracking-wider, `text-[10px]`) over model name (bold, `text-xs sm:text-sm`, `truncate`) |
| 3 | `20fr` | the meta row, unchanged in content: colorway grid \| price \| score, now explicitly 3 columns |

**Why:** the photo is the product, and an overlay label competes with it. Giving the name its own band buys a clean image and legible type at every card size, for 15% of the card height taken from the meta row — which at 20% still fits two rows of swatches plus two text lines.

**Still `fr`, not `%`.** The layout sketch that prompted this used `h-[65%] / h-[15%] / h-[20%]`. Kept as `grid-rows-[65fr_15fr_20fr]` instead: fractional rows are what make the split exact and immune to content pushing it around, which is the whole reason the original 65/35 rule was written. Percentage heights would reintroduce that bug. The ratios are exactly as specified; only the unit differs.

**Consequences:**
- `BackpackCard.vue` is `grid-rows-[65fr_15fr_20fr]`. `CardLabel.vue` is in normal flow in band 2, no longer `absolute` / `pointer-events-none`.
- The carousel's click zones no longer need to be layered above anything, and the colorway pager can no longer accidentally advance the image — it is outside the carousel entirely. Keep its `stopPropagation` for the card-level navigate-to-detail handler.
- "**The label must not move or re-render as images cycle**" is now guaranteed *structurally*: it lives in a different grid row, so nothing that changes on image swap can touch it. This was previously the project's headline risk, enforced by careful stacking. It is now free. The E2E assertion stays as a cheap regression guard, demoted from "the core spec".
- Model name must `truncate`; a wrapping name would grow band 2 and break the ratio.
- Band 3's three regions become explicit columns. Column 3 shows the score over `review.source`, mirroring column 2's price over `price.retailer`. (The prompting sketch wrote "Verified" on that second line; read as the source label, since no such field exists and ADR-009 forbids inventing one.)
- Worst case to verify is the **260px** card: 364px tall → band 2 = 55px, band 3 = 73px.
- The photo carries no text, so nothing needs to be made legible against it. `CarouselImage` is `base` / `widths` / `width` / `height` / `alt` and nothing more; the ingest pipeline is fetch-images → process-images → build-catalog.

## ADR-022 — `ColorFamily` is a closed 13-member union
**2026-09-02 · Accepted**

The plan's data model typed `Colorway.family` as `ColorFamily` but never defined it. Defined now, in `app/types/backpack.ts`:

```
'black' | 'grey' | 'white' | 'navy' | 'blue' | 'green' | 'olive'
| 'tan' | 'brown' | 'red' | 'orange' | 'purple' | 'multi'
```

**Why a closed union rather than `string`:** this is the backing type for the Phase 6 colour filter. A facet list that grows with the data is not a filter — it is a legend. Closing the set forces ingest to map free-form marketing names ("Desert Palm", "Peppercorn", "Ranger Green") onto a fixed vocabulary, which is the only way the filter stays usable at 20 packs or at 100.

**Why these members:**
- `navy` split from `blue`, `olive` split from `green` — both are disproportionately common in this category and near-black navy is a different purchase decision from saturated blue. Collapsing them would leave one enormous facet doing no work.
- `tan` absorbs khaki/sand/desert; `brown` absorbs coyote/peppercorn.
- `multi` covers camo, colour-block, and prints, which no single family describes.
- No `yellow` or `pink` — vanishingly rare above 14L, and a facet with zero or one hit is noise. Widening a union is non-breaking, so starting small is cheap to reverse.

**Consequences:**
- Ingest (Phase 4) maps onto **exactly** these values; the toolbar (Phase 6) facets on **exactly** these values. If either re-derives its own list they will silently disagree, which is why this is an ADR rather than a comment.
- The zod schema validates `family` against the union, so a typo fails the build instead of quietly dropping a colorway out of the filter.
- Lowercase single words, so values go straight into URL query params (filter state is URL-backed, ADR-004) with no encoding or casing step.

## ADR-023 — The "14–30L" capacity spread was wrong and is withdrawn
**2026-09-02 · Accepted**

The ranked-20 table carried a derived summary line: `Spread: $60–$435, 14–30L, 19 distinct brands`. Phase 2 fixture work raised the capacity figure as suspect. Four spot-checks confirmed it is wrong at **both** ends:

| Pack | Claimed basis | Actual (verified 2026-09-02) |
| --- | --- | --- |
| Aer Travel Pack 3 (rank 4) | within 30L ceiling | **35L** — Travel Pack 3 *Small* is 28L |
| Incase ICON Slim (rank 17) | the 14L floor | **19L** current; 14.5L was the superseded generation |
| Chrome Barrage Cargo (rank 18) | — | 18→22L ✓ |
| Arktype Dashpack (rank 19) | — | 15L ✓ |

**Why withdraw rather than restate:** only 4 of 20 packs have been checked. Replacing one unverified precise claim with another would repeat the mistake. The line now says capacity is not yet stated and points here; Phase 5 captures `capacityLiters` for every pack and the spread is restated from data.

**The open question this exposes — is rank 4 a 35L travel pack?** The catalog is *Everyday Carry* backpacks. 35L is luggage-adjacent, and the entry's basis ("one of the most beloved EDC go-anywhere packs ever") describes the Travel Pack *line*, not that specific volume. Aer's 28L **Travel Pack 3 Small** sits far more naturally in an EDC list and is the same design. **Phase 5 must pick one**, by ADR-019's precedent: prefer the variant that matches the catalog's purpose, and record in `data/seed.ts` `rationale` that the acclaim attaches to the line. Not resolved here because it is an editorial ranking call on researched data, and no research has happened yet.

**Consequence:** treat *every* capacity in the ranked-20 table as unverified until Phase 5. The two errors found were in the two packs already flagged as likely superseded (ADR-019) plus one nobody suspected, which is the actual lesson — the table's specs were never sourced.

## ADR-024 — Card component decisions Phase 3 committed to
**2026-09-02 · Accepted**

Five things building the card set settled that later phases must not undo. Conventions that follow from them are in `docs/component-conventions.md`; this entry is the *why*.

**Two more util modules than the plan listed.** The plan's file listing said `app/utils/{format,color}.ts`. It is now four: `cycle.ts` (wrapping index arithmetic and the whole colorway-page render model) and `image.ts` (`srcset`/`src` construction from `CarouselImage`) were added, and the plan's listing updated to match. **Why:** the plan's own Verification section names carousel wraparound at n=1, and swatch paging at 0/4/8/9/15/22, as unit tests. Logic that must be unit-tested cannot live in an SFC, and neither belongs in a formatter or a colour module. `colorwayPage()` deliberately returns one render model rather than three helpers, because that is what makes the ADR-015 invariant assertable in one line: `items.length + ghostCells + (hasPager ? 1 : 0) === 8`.

**The detail-route link is deferred behind an optional `to` prop, not hard-coded.** `BackpackCard` and `CardLabel` take `to?: string`; when it is absent the model name renders as plain text, when present it renders a `<NuxtLink>`. Phase 3 passes nothing. **Why:** `/pack/[slug]` does not exist yet and `nitro.prerender.crawlLinks` is on, so emitting the link now would have every card ask the prerenderer for a 404. **Consequences:** Phase 6 turns navigation on by passing `` :to="`/pack/${pack.slug}`" `` and changes nothing else. Navigation is the **name link** — not a whole-card click handler and not a stretched-link overlay, which would have to cover band 1 and would swallow the carousel's click zones. The pager keeps its `stopPropagation` (ADR-015) as a guard for the card-body handler Phase 6 may add; it is not dead code to be tidied away.

**Carousel images are all mounted and toggled with `v-show`, not swapped through one `<img src>`.** **Why:** mutating `srcset` on a live `<picture>`/`<source>` is not reliably re-evaluated across browsers, and forcing a keyed remount instead re-decodes on every click — a visible flash on a control the user is expected to press repeatedly. At most 5 images per pack (ADR-008) this costs nothing. **Consequence:** hidden images are `display: none`, so `loading="lazy"` never resolves for them (no box, so they never intersect). The component therefore flips neighbours to `loading="eager"` on the *first* interaction rather than at mount — preloading at mount would cost 20 cards × up to 5 images on a page nobody may touch. The first swap can still flash; every one after it does not.

**The carousel's dot strip is a row below the image, and it renders even at one image.** The plan had dots inside band 1 without saying whether they overlay the photo. They do not: band 1 is `grid-rows-[1fr_auto]`, image region then a fixed 16px dot row. **Why:** ADR-021 moved the label off the photo because an overlay competes with the product; the same reasoning applies to dots. The empty row is kept for single-image packs so the image region is the same height on all 20 cards — otherwise geometry stays legal per ADR-021 (bands are unchanged) while cards visibly disagree. **Consequence:** usable image height is band 1 minus 16px, uniformly.

**`min-h-0` on every band is part of the geometry rule, not a detail.** `grid-rows-[65fr_15fr_20fr]` alone does *not* pin the split: an `fr` track keeps an automatic min-content floor, so a tall child can still stretch its band. Each of the three bands is `min-h-0 overflow-hidden`. **Consequence:** "use `fr`, never `%`" (ADR-021) is necessary but not sufficient — a future band that forgets `min-h-0` will pass code review and fail the E2E ratio assertion.

**Also settled, smaller:** `@theme` in `main.css` carries semantic *colour* tokens only (`card-surface`, `card-border`, `card-muted`, `swatch-ghost`); the geometry and type sizes ADR-021 specifies stay as literal utilities in the SFC, so the card can be checked against the ADR by reading the card. And `app/pages/index.vue` imports `app/data/fixtures.ts` directly — the fixture file's header comment previously forbade that outright and has been narrowed to the rule that actually matters (fixtures must never *ship as catalog data*, ADR-009). Phase 6 swaps the import for `catalog.json`.

## ADR-025 — Ingest pipeline decisions Phase 4 committed to
**2026-09-03 · Accepted**

Seven things building the pipeline settled that later phases — Phase 5 above all, which runs this code seventeen more times — must not undo.

**Determinism is bought explicitly, not assumed.** ADR-014 requires byte-identical output from unchanged inputs, and an image encoder is the usual place that guarantee dies. `process-images.ts` sets `sharp.concurrency(1)` (libaom's threading can vary bit output between runs), `sharp.cache(false)`, never calls `withMetadata()` (so no capture timestamp or ICC payload reaches the output), calls `.rotate()` before `.resize()` so stripping metadata cannot flip an image, and pins every encoder parameter including `kernel`, which is a sharp default today and might not stay one. `catalog.json` is assembled with an explicit key order and sorted by rank, so neither `Object.keys` order nor filesystem iteration order can reach the bytes. **Verified, not asserted:** `--reencode` (or `INGEST_REENCODE=1`) re-encodes all 60 variants from cache and the SHA-256 of the output set is unchanged, as does deleting `public/images/` entirely. Keep that switch — a plain re-run *skips*, so it is the only thing that distinguishes "deterministic" from "not re-run at all".

**The cache is keyed on the URL, and the encode is stamped on the source hash.** A cached original is reused when `.ingest-cache/{slug}/manifest.json` records the *same URL* at the same index and the file is still on disk, so changing one URL in a capture re-fetches exactly one image and nothing else. `.ingest-cache/{slug}/processed.json` stamps each output with the source SHA, the encoder identity (sharp + libvips version + every parameter), and the SHA of the bytes written; an output that is missing or altered fails its stamp and is re-encoded. **Why the stamp lives in `.ingest-cache/` and not `public/images/`:** everything under `public/` is copied verbatim into the static build, and bookkeeping has no business shipping to browsers.

**Two failure classes, handled differently on purpose.** Network and artefact failures are isolated per pack: a blocked host costs you one card, the catalog still builds without it, and the run exits non-zero with a summary. Authoring failures — a malformed capture, an unmappable colour name, a duplicate rank — are fatal: nothing is written and the previous catalog survives intact. A preflight pass validates every `data/sources/{slug}.json` before any stage runs, so an authoring error costs seconds rather than surfacing after minutes of AVIF encoding. **Consequence for Phase 5:** a batch of five where one pack is blocked still produces four usable cards; a batch where one JSON has a typo produces nothing until it is fixed. That asymmetry is intended.

**Sources below 1280w are upscaled, and the run says so.** `widths` is pinned to `[640, 1280]` by the schema, so emitting a narrower file would make every `srcset` in the catalog a lie. `withoutEnlargement` is therefore `false` and the log warns per image. Seven of the first fifteen images hit this — ALPAKA's originals are 1020px. **The alternative considered and rejected:** per-image `widths`. It would be honest, but it moves a fixed invariant into data and every consumer of `CarouselImage` would have to handle a variable-length array to save a small amount of upscaling on some packs.

**Colorway `hex` is sampled from the brand's own photograph, and records which one.** No brand in this category publishes a machine-readable swatch colour, and ADR-009 forbids inventing one. Each colorway in `data/sources/{slug}.json` carries `hex` plus a `swatchSource` URL: the hex is the median-luminance pixel of the central 40% of that photograph with the background discarded, so the value is auditable rather than eyeballed. **Consequence:** `swatchSource` is not optional in practice — a hex without one is an unsourced claim, and Phase 5 should treat it as incomplete. Where a colorway has no photo at its own capacity (GORUCK sells Coyote and Navy + Gold only as 21L imagery), the same fabric's photo at another size is used and the capture's `notes` says so; colour is a fabric property, not a size one.

**`family` is derived, and an explicit override is data.** Ingest calls `colorFamilyFromName` from `app/utils/color.ts` — the same module the Phase 6 filter facets on (ADR-022) — and a `null` result **fails the build** rather than defaulting to `multi`, which would bucket every unrecognised name into one facet and hide the gap forever. An explicit `family` in the capture wins over the guess and is still validated against the union. Three of the first twenty-seven colorways needed one, and each is a case the keyword table cannot know: "Black Tiger Stripe" and "Black Frogskin + Wolf Grey" are prints (`multi`, not `black`), and "Desert Brown" is `brown` where the table's `desert` keyword says `tan`. **Rule for Phase 5:** if the *name* is the problem, add the keyword to `app/utils/color.ts` so the filter learns it too; only use an override when the name is genuinely ambiguous.

**Pipeline options are arguments, never ambient environment state.** `scripts/ingest.ts` parses every flag in its own body and passes the result down; no stage reads an option out of `process.env` that `ingest.ts` wrote. This is a rule rather than a preference because violating it is *silent*: `--reencode` originally worked by setting `process.env.INGEST_REENCODE`, but `process-images.ts` captured that variable in a module-level `const`, and ESM evaluates a statically imported module before the importing module's body runs — so the assignment always landed too late, the flag re-encoded nothing, and the run still exited 0 looking like it had worked. The first Phase 4 gate evidence was collected with that broken flag and had to be re-derived. Consequences: options are parameters (`processImages(slugs, { reencode })`); the env vars that remain (`INGEST_OFFLINE`, `INGEST_REENCODE`) are read inside functions at call time, never captured at module scope; flag and env var are combined into one boolean at a single decision point, so neither can be quietly dead; and `ingest.ts` rejects unrecognised arguments rather than ignoring them, because a typo'd flag is the same silent-no-op failure wearing a different hat.

**`app/data/catalog.json` is now gitignored.** ~~ADR-012 and ADR-014 both already state it is a build artifact that a fresh clone must regenerate, but `.gitignore` never said so and Phase 4 was the first run that produced one. Implemented, not decided anew.~~ **Superseded by ADR-030** — the file is tracked, and the `.gitignore` rule this bullet added has been removed.

**Known gap: `scripts/` and `data/` are not type-checked.** Neither directory is in any tsconfig project (`.nuxt/tsconfig.app.json` includes `app/**` only; `tsconfig.node.json` includes config files only), and `@types/node` is not an installed dependency, so `pnpm typecheck` reports zero errors while never opening the ingest pipeline. Checked manually with a throwaway config: zero authored type errors, 49 diagnostics, all of them `Cannot find name 'Buffer' | 'process' | 'URL' | 'fetch'` from the missing `@types/node`. **Not fixed here:** `tsconfig.json` and `package.json` belong to `build-tooling-specialist`, and adding a dependency was out of scope. The fix is `@types/node` as a devDependency plus a `tsconfig.scripts.json` in the solution-style root's `references`. Until then the pipeline's only type feedback is running it.

## ADR-026 — Rank 4 is the Aer Travel Pack 3 Small 28L, a discontinued model
**2026-09-03 · Accepted**

Phase 5's first research batch found that **both** Aer Travel Pack 3 sizes are discontinued: `aersf.com` shows "This item has been discontinued and will not be restocked" on the 35L and the 28L Small alike, each naming a Travel Pack 4 as its replacement. Aer shipped the Travel Collection V4 around March 2026. Rank 4 is nevertheless captured as the **Travel Pack 3 Small (28L)** — the discontinued model itself, not the successor.

**This deliberately deviates from ADR-019.** That entry's surviving generalisation is that Phase 5 confirms a pack is still in production *before* researching it, and its own case (Citadel R2 → R3) resolved by inheriting the rank to the successor. Rank 4 does the opposite, for one reason: **the Travel Pack 4 has no review score.** `sourceSchema` requires `review.score`, `scale`, `source` and `url`, and ADR-009 forbids inventing data or borrowing a predecessor's score. No enthusiast review of the TP4 could be found beyond a release write-up, so a TP4 capture cannot currently be written at all. The TP3 Small has Pack Hacker's 8.6/10 of that exact size.

**Why the 28L and not the 35L.** ADR-023 already flagged the 35L as arguably outside EDC scope, and it is the size the ranked table's "go-anywhere EDC pack" basis was never really about. The 35L also scores higher (Pack Hacker 9.2/10 versus 8.6/10), so this is a deliberate choice of scope fit over score.

**The alternatives, and why not:** capturing the TP4 with no review is impossible under the schema; retiring rank 4 and promoting ranks 5-20 upward is a far larger ranking change than one entry and loses nothing in return; waiting for a TP4 review blocks the whole phase on a third party.

**Consequences:**
- The ranked-20 table names **Travel Pack 3 Small 28L** at rank 4, and `data/seed.ts` `rationale` must say the model is discontinued — the same caveat convention ADR-019 established for an inherited rank.
- The captured price is an **end-of-life price** and more volatile than the rest of the catalog: it may go to clearance or the page may disappear. Re-running ingest could fail on this pack alone, which ADR-025's per-pack failure isolation already handles.
- Only the Black colorway was still in stock at capture. The catalog contract has no stock field and is not gaining one, so per-colorway availability lives in the capture's `notes` and nowhere else.
- **Revisit when a TP4 review lands.** At that point the ADR-019 succession applies normally and rank 4 should move to the Travel Pack 4 28L, inheriting the rank.
- ADR-019's production check stands for the remaining sixteen packs. This is an exception with a stated reason, not a repeal — a discontinued pack is still the wrong default, and the next one that comes up gets its own decision rather than citing this entry as precedent.

## ADR-027 — `swatchSource` is provenance, not carousel content
**2026-09-03 · Accepted · Clarifies ADR-025**

`colorways[].swatchSource` was misread during Phase 5 as implying that each colorway needs a photograph in the pack's carousel, and therefore that a pack with more colorways than the 1-5 images ADR-008 allows could not have sampled hexes at all. That inference is wrong, and the confusion is worth recording because it argues for weakening a data rule that does not need weakening.

**`images` and `colorways` are independent, disjoint sets.** `images` is what the card's carousel displays and is capped at 5 (ADR-008). `swatchSource` is an audit trail: the URL of the brand photograph a `hex` was sampled from, recorded so the value is checkable rather than eyeballed (ADR-025). A `swatchSource` **may point at any brand photograph, and usually points at one that is not in `images`** — it is never rendered, and nothing requires it to be fetched by the pipeline. The existing GORUCK capture is the worked example: **13 colorways, 13 `swatchSource` values, 5 carousel images — only 3 of the 13 overlap.** A twelve-colorway pack with five images is therefore entirely ordinary, not a contradiction.

**Consequences:**
- **ADR-025's sampling rule is unchanged.** A hex without a `swatchSource` is still an unsourced claim and still counts as incomplete. Name-derived hexes are a temporary state to be corrected, not an accepted form of catalog data.
- Nothing needs to be added to the contract: `sourceSchema` already types `swatchSource` as a free `z.url()` with no relationship to `images`, and `colorwaySchema` on the catalog side drops it entirely, so it never ships to the browser.
- The number of colorways a pack has puts **no** ceiling on the number that can be sampled, and the ADR-008 image cap puts none either. Research effort scales with colorway count, which is the intended cost.
- Where a colorway truly has no photograph anywhere, the ADR-025 fallbacks stand: use the same fabric's photo at another size or variant and say so in `notes`, or keep the derived hex, omit `swatchSource`, and name that colorway in `notes`. A fabricated `swatchSource` is the one unacceptable outcome.

## ADR-028 — The swatch sampler is a script, and its parameters are pinned
**2026-09-03 · Accepted · Amended by ADR-029**

ADR-025 pinned the *method* — "the median-luminance pixel of the central 40% of that photograph with the background discarded" — but Phase 4 executed it by hand, and Phase 5's first research batch consequently shipped eighteen name-derived hexes with no `swatchSource` at all across four captures. `scripts/sample-swatch.ts` (`pnpm sample-swatch`) implements the method so the remaining packs cannot repeat that. It is deliberately **not** an ingest stage: ingest reads `hex` out of the capture, and sampling is an authoring aid whose output a human pastes into `data/sources/{slug}.json` together with the URL it came from. Making it a pipeline stage would let the catalog's colours change without any tracked file changing, which is the opposite of ADR-014.

**A prose method is not reproducible; these five choices are the method.** ADR-025's sentence leaves five things open, and different answers give different hexes, so they are pinned here and any change to one is a change to every hex in the catalog. (1) *Central 40%* is 40% per axis — a centred 0.4w × 0.4h box, 16% of the frame — with integer crop arithmetic and no resize, so every sampled value is a pixel the brand actually published rather than a resampling artefact. (2) *Background* is `alpha < 128`, **or** `min(r,g,b) >= 235` **and** `max−min <= 12`. Both halves of the second test are required: brightness alone eats light grey and tan fabrics, neutrality alone eats the black and grey packs that are most of this catalog. There is deliberately no dark cutoff — a shadow is part of the photograph, and discarding dark pixels would destroy the colorways the median is meant to describe. (3) *Luminance* is Rec. 709 on sRGB-encoded values. (4) The *median* is the lower median for an even count, never an average — an averaged median would emit a colour present in no pixel. (5) *Ties* break on r, then g, then b, giving a total order, which is what makes the result deterministic rather than dependent on sort stability.

**Validated against the hand-sampled set before it was trusted on new data.** Re-sampling GORUCK's thirteen colorways against their recorded `swatchSource` reproduces all thirteen within a maximum per-channel delta of 7/255 (mean 4.2, median 4, min 1); none is exact. That residual is the five choices above, which the hand pass never wrote down. **The GORUCK values were not rewritten to match the script** — they are the evidence that the method predates the tool, and overwriting them would have destroyed the only way to tell which of the two is wrong. Consequence: `--check=<slug>` exits 0 on a nonzero delta and 1 only when a photograph cannot be sampled or a colorway has no `swatchSource`, because a disagreement is for a human to adjudicate.

**The sampler's cache is `.ingest-cache/.swatch/`, keyed on the URL.** A dot-prefixed sibling of `.robots/` rather than a per-slug directory, because ADR-027 already established that a swatch source is usually a *variant* photograph that appears in no pack's `images`. `INGEST_OFFLINE=1 pnpm sample-swatch --check=<slug>` re-derives every hex with zero network requests, which is how the four corrected captures were verified: all eighteen reproduce at delta 0.

**Where the method needs a human before it is trusted.** Two failure shapes showed up immediately in Phase 5 batch 1 and will recur. First, **contrasty studio lighting drags the median well below the colour a viewer reads off the thumbnail** — Peak Design's Coyote X-Pac sampled `#724d25` against a name-derived guess of `#9a7a55`, and Ash `#727272` against `#b6b1a7`. That is the pinned method behaving correctly on darker source photography, not a bug, but every sample was checked against its own crop before being written and future batches should do the same. Second, **sampling can contradict an explicit `family`**: the photographs show Peak Design's Kelp as an olive-khaki (captured as `green`) and Eclipse as a deep burgundy (captured as `purple`). Both were left as captured and flagged in the file's `notes`, because a `family` correction is an ADR-022 decision about what the colour filter means, not a hex correction, and silently changing one under cover of a hex pass is how the union's meaning drifts.

**Consequence for the remaining sixteen packs.** A capture is not finished until every colorway has a `swatchSource` or its `notes` names the colorway that could not be sourced and why. `pnpm sample-swatch --check=<slug>` is the check for that, and it is cheap to run because the answer comes from cache.

## ADR-029 — Swatch colour accuracy is best-effort; the sampling method stands
**2026-09-03 · Accepted · Amends ADR-028**

ADR-028 left the dark skew open: sampling a photograph inherits its studio lighting, so the catalog's swatches sit low — median luminance 71 across 45 colorways, 36 of them below 100 — and four of Phase 5 batch 1's resampled hexes moved 30-68 per channel against their name-derived guesses, Peak Design's Ash (`#b6b1a7` → `#727272`) worst among them. That was written up as something a human should adjudicate before trusting.

**Adjudicated: the objective is best-effort, not hex-identical, and the method is unchanged.** A colorway swatch exists so a viewer can tell one colorway from another and recognise roughly what colour it is. It is not a colour-matching tool, nobody is ordering fabric from it, and no brand publishes a machine-readable swatch colour to be accurate *against* — so there is no ground truth to be measured against in the first place. A sampled value that is auditable, reproducible and traceable to a specific published photograph is worth more here than a prettier value someone eyeballed, even when the prettier one would read better in the grid.

**Consequences:**
- **Do not retune the five pinned parameters to lighten the output**, and do not hand-edit a hex because it looks muddy next to the product photo. Both are the same mistake: trading a reproducible value for an unreproducible one to chase an accuracy target this project does not have.
- A delta between a sampled hex and what a viewer reads off a thumbnail is **not a defect** and should not be filed as one. ADR-028's `--check` still exists to catch a hex that no longer matches its own recorded photograph, which is a real error; a hex that matches its photograph and still looks dark is working as intended.
- This is not a licence to skip sampling. ADR-025 stands: a hex still comes from a photograph, and still records which one. "Best effort" describes the *accuracy target*, not the *evidence standard*.
- If the swatch grid genuinely reads as unusable once Phase 6 renders twenty packs side by side, that is a **presentation** problem to solve in the component — border, contrast, a hover label naming the colorway — before it is a reason to reopen the sampling method.

## ADR-030 — `app/data/catalog.json` is committed
**2026-09-03 · Accepted · Supersedes the gitignore decision inside ADR-025**

Phase 4 added `app/data/catalog.json` to `.gitignore` on the reasoning that ADR-012 and ADR-014 already called it a build artifact a fresh clone regenerates. The file was nevertheless committed, so the repository has since asserted both things at once: the rule sat in `.gitignore:21` while the tracked file made it inert. That contradiction is resolved in favour of **tracking the file**, and the rule is removed.

**Why tracking wins.** Phase 6 swaps `app/pages/index.vue` from `fixtures.ts` to `catalog.json`, and from that point the app does not build without it — `typecheck`, `test` and `generate` all fail on a fresh clone until someone runs ingest. Ingest fetches from brand and retailer CDNs, and Phase 5 batch 1 alone collected 403s from Huckberry, B&H, Adorama and Abt. Gitignoring the catalog therefore makes the repository's own build depend on third-party site availability and bot policy, which is a far worse failure mode than a regenerable file occasionally conflicting in a merge. The second benefit is review: for a catalog whose entire value is researched data, a price or score moving shows up in a PR diff.

**Why this does not weaken ADR-014.** That ADR is about *hand-editing* and provenance, not about version control. `catalog.json` is still generated, still must never be edited by hand, and content changes still go to `data/seed.ts` or `data/sources/{slug}.json` followed by a re-run. Tracking the output changes where it lives, not who writes it. The tracked inputs in `data/sources/` remain the actual record.

**Why `public/images/` is not reconsidered.** ADR-012 is a copyright decision, not a convenience one, and nothing here touches it. Note the honest consequence: tracking the catalog buys a clone that **builds**, not one that **renders** — every entry points at `/images/{slug}/N`, which is still absent until ingest runs. Anyone reading "the catalog is committed" as "the clone works now" has misread it.

**Consequences:**
- `.gitignore` no longer lists `app/data/catalog.json`; `public/images/` and `.ingest-cache/` still are.
- Running `pnpm ingest` now produces a reviewable diff. **Read it** — an unexpected change to a pack you did not touch is a signal, and it is the main thing this decision buys.
- **Merge conflicts on this file are noise, not content.** Resolve them by re-running `pnpm ingest` on the merged inputs, never by hand-merging JSON — hand-merging is exactly the ADR-014 violation this decision must not invite.
- One real risk to watch: `width`/`height` derive from the fetched originals, and Shopify's CDN honours the `Accept` header, so two machines populating a cold `.ingest-cache/` can receive different bytes for the same URL and emit different dimensions. That would produce a diff representing no actual change. Pinning `Accept` in `scripts/fetch-images.ts` is the fix if it ever bites.

## ADR-031 — Ranks 8 and 11 inherit to the Catalyst 26 and the Rhake LS
**2026-09-03 · Rank 11 accepted; rank 8 half superseded by ADR-032**

> **Correction, 2026-09-03.** The rank 8 half of this entry rests on a premise that is false. The Catalyst 26 is itself discontinued: `mysteryranch.com/catalyst-26-pack` 301s to a category page, the storefront commerce API holds 163 items and zero Catalyst at any size, and the Everyday Carry category is down to 12 items with no 3-Zip pack of any kind. The cause is that YETI is retiring the Mystery Ranch **consumer** line and keeping only the military, wildfire and hunting business. So nothing "took over the Urban Assault URLs" — the brand left the category, and rank 8 has no inheritance path inside Mystery Ranch. No capture was made and no seed entry written. Rank 8 was therefore retired rather than inherited again — see ADR-032. The rank 11 half below stands and is captured.

Phase 5 batch 2 found two more of the ranked twenty discontinued. Both ranks inherit to the direct successor, as ADR-019 did for the Black Ember Citadel R2 → R3.

**Rank 8 — Mystery Ranch Urban Assault 24 → Catalyst 26.** The UA24 is gone, confirmed three independent ways: absent from `mysteryranch.com`'s 601-URL product sitemap; its own path serves generic homepage content while a sitemap-listed control product renders full detail through the same fetcher, so it is a soft 404 rather than a fetcher limitation; and its URLs are now titled "Catalyst 22" and "Catalyst 26" in the search index, with the Catalyst 26 holding its own canonical URL. The Catalyst line has taken over the Urban Assault URLs, which makes the succession the brand's own rather than our inference.

**Rank 11 — Mission Workshop Rhake VX → Rhake LS.** The Rhake VX returns HTTP 404 on apex and www, is absent from the 263-URL product sitemap and from both the backpacks and VX-21 collections, and the site's own search returns only Rhake LS, Rhake LS Ultra and a legacy accessory. The surviving accessory name ("Cobra Buckle Set: HT500 & Black Camo Rhake") incidentally confirms the VX/HT500 fabric split the plan warned about — and it disappears on inheritance, because the Rhake LS is VX-21 only at a single price.

**What does not transfer: the score.** ADR-009 forbids borrowing a predecessor's number, so the Urban Assault's Pack Hacker **8.9/10** does not move to the Catalyst 26 and no Rhake VX review moves to the Rhake LS. Each successor must be captured with a review of itself or not at all — `sourceSchema` requires `review`, so a successor with no independent score cannot be captured, and that is a human decision rather than something research works around. This is the same bind rank 4 hit (ADR-026) and rank 7 is currently sitting in.

**Consequences:**
- The ranked-20 table names Catalyst 26 at rank 8 and Rhake LS at rank 11, each marked as an inherited rank, matching how rank 9 is marked.
- `data/seed.ts` `rationale` for both must say the rank was inherited rather than earned by this model, and say what the predecessor earned it for. ADR-019 established that convention; three of twenty entries now use it.
- **Losing the UA24 costs the list its highest score.** At 8.9/10 it outscored everything in the current top five, so the ranking's acclaim basis is now carried by weaker evidence at rank 8 than it was. Revisit rank 8's *position* once the Catalyst 26 has been reviewed into one, rather than assuming the inherited slot is still right.
- **The plan's "$60–$435" price spread is now in doubt.** The Rhake LS researched at **$525**, above the stated ceiling. Treat the spread as unverified until Phase 5 completes and restate it from captured data, exactly as ADR-023 did for the capacity range rather than patching one endpoint.
- Four of twenty packs have now been discontinued mid-project (Citadel R2, Travel Pack 3, Urban Assault 24, Rhake VX). ADR-019's production check is not a formality — it has fired on 20% of the list.

## ADR-032 — Rank 8 is retired; the list is 19 packs
**2026-09-03 · Accepted · Supersedes the rank 8 half of ADR-031**

ADR-031 inherited rank 8 from the discontinued Mystery Ranch Urban Assault 24 to the Catalyst 26. That was wrong on the facts: **the Catalyst 26 is discontinued too.** `mysteryranch.com/catalyst-26-pack` 301s to a category page while control products return 200, the storefront's commerce API holds 163 items and zero Catalyst at any size, and the Everyday Carry category is down to 12 items with no 3-Zip pack of any kind. The cause is not a URL move: **YETI is retooling the Mystery Ranch consumer line into YETI**, keeping only the military, wildfire and hunting business. The 163 survivors are exactly those categories.

**Rank 8 is retired and every rank below it moves up one.** The list is now **19 packs across 18 brands**. Mystery Ranch leaves the catalog entirely.

**Why not inherit again.** The only live 3-Zip candidate is the Rip Ruck 24 at $169, from the side of the business YETI is keeping — but no review score for it could be verified, and `sourceSchema` requires `review`, so it is very likely uncapturable in the same way the Aer Travel Pack 4 was (ADR-026). Inheriting a rank to a pack that cannot be captured moves the problem rather than solving it. It also fails ADR-017 independently: every readable Catalyst 26 listing is sold out, so no true "lowest available price" claim exists for the successor either.

**Why not backfill a new rank 19.** Keeping the count at 20 would mean inventing a new entry, and ADR-018 makes the ordering editorial judgment that must stay auditable. A pack added to preserve a round number is exactly the kind of entry that has no defensible `rationale`. Nineteen well-founded ranks beat twenty with one make-weight.

**Consequences:**
- The ranked table, `data/seed.ts`, `CLAUDE.md` and the curator's agent definition all say **19**, not 20. Captured ranks renumbered 9→8, 10→9, 11→10, 12→11; the six above rank 8 are untouched.
- **The brand spread drops to 18** (Aer still appears twice). ADR-008's "20 packs" scope figure is now 19 — it was a scope cut, not a target, so it does not need reopening.
- `backpackSchema` still allows `rank` up to 20. Deliberately left alone: a permissive ceiling costs nothing and tightening it is a pipeline change with no defect behind it. Uniqueness is what actually matters and is still enforced.
- **Rank 7 (Bellroy) is still an open gap** and is unrelated to this. It is unresearched, not retired.
- **Five of the original twenty have now been discontinued mid-project** — Citadel R2, Travel Pack 3, Urban Assault 24, Rhake VX, and the Catalyst 26 that was meant to replace one of them. A successor dying before it can be captured is a new failure shape: ADR-019's production check must be run against the *successor* too, not just the incumbent, before an inheritance is written into an ADR.

## ADR-033 — Ranks 7 and 16 stay absent and reserved, rather than retired or filled
**2026-09-03 · Accepted · Completes Phase 5 research**

Phase 5 batches 3 and 4 researched every remaining rank. Seven were captured (12, 13, 14, 15, 17, 18, 19), bringing the catalog to **17 of the ranked 19**. Two could not be, and both failed on the same thing: a field `sourceSchema` requires could not be read off a live page.

**Rank 7, Bellroy Classic Backpack Plus — blocked on `price` alone.** The pack is in production, and this round recovered a real Pack Hacker score (8.0/10, updated 2023-06-19), usable photographs and a colorway list. What is missing is a live USD price. bellroy.com is a client-rendered SPA with no JSON-LD and no Shopify product endpoints (confirmed 404 — it is not Shopify); Amazon returned 500, REI and Huckberry 403, Nordstrom and Nordstrom Rack were sold out, Zappos and Backcountry unusable. Two USD figures exist and neither qualifies: Pack Hacker's article text cites $189 direct in a review over three years old, and Carryology cites $179. A Philippine retailer has it live and in stock at PHP 13,005 (roughly $208), deliberately not converted.

**Rank 16, Incase ICON Slim — blocked on both `price` and `review`.** The product page is live, not redirected, and still merchandised in the current Backpacks collection at $129.99 — but it reads "Coming Soon", shows 0 in stock and has no Add to Cart. No retailer carries this SKU; the Best Buy, B&H and Amazon listings found are an older generation with different SKUs and colorways. Pack Hacker has never reviewed the Slim: it scored the ICON Backpack 7.7/10 and the ICON Lite 7.3/10, which are different packs, and ADR-009 forbids borrowing a sibling's score.

**Decision: leave both ranks absent, and keep the rank numbers reserved.** The list is not renumbered around the gaps, and no substitute is written in.

**Why not retire, as ADR-032 did to rank 8.** ADR-032's basis was evidentiary: the brand was demonstrably exiting the category. Neither of these is that. Bellroy has not left the category — this is a fetch failure, not a product failure, and retiring an acclaimed pack because its retailer refused an HTTP request would let infrastructure decide editorial content. Incase's page is current and not redirected; "Coming Soon" most plausibly resolves on its own.

**Why not fill either with the figures that exist.** The card claims "lowest available price", and ADR-017 makes that claim auditable by requiring a real comparison. A price lifted from three-year-old article prose was never compared to anything, and converting PHP 13,005 would launder local market pricing into a US price point. Both would make a rendered claim false. ADR-009's "a missing field is fine; a fabricated one corrupts the catalog silently" applies directly.

**Why not relax the schema for rank 16.** Its price *is* readable; only the score is missing. Allowing a scoreless pack would mean a nullable `review`, which propagates into `ScoreBlock`, into Phase 6's score sort and filter, and into the normalized `score / scale` comparison — a real design change to accommodate one pack that may be back in stock shortly.

**Consequences:**
- The catalog ships **17 packs**, with 7 and 16 as documented holes. Rank gaps are expected and are not a defect; nothing renumbers.
- **Recapture is the intended path.** Re-check Bellroy for a readable price and Incase for stock plus a Slim-specific review. Neither needs new research from scratch — batch 3's Bellroy findings are recorded in `data/seed.ts`.
- `capacityLiters` is now verified for 17 of 19. **The capacity and price spreads that ADR-023 and ADR-031 withdrew stay withdrawn** until the last two land, rather than being restated against an incomplete list and restated again later.
- Six of the original twenty have now been discontinued, retired or blocked mid-project. Sourcing attrition is the dominant risk on this project, well ahead of anything technical.

## ADR-034 — Catalog shell decisions Phase 6 committed to
**2026-09-03 · Accepted**

Phase 6 added the toolbar, the filter/sort composable and the `/pack/[slug]` detail route. Nine decisions that later work has to respect, none of which the plan settled in advance.

**1. The URL is the state, and a default is an absent parameter.** `useCatalogFilters` reads `route.query` and writes it back; there is no store and no shadow copy (ADR-004). Params are `q`, `brand`, `color`, `maxPrice`, `minScore`, `sort`, and **any value at its default is omitted entirely** rather than written as `q=` or `sort=rank`, so the unfiltered catalog is a bare `/` and every parameter present in a URL is one a user actually chose. Lists are comma-separated single params (`?color=black,olive`), not repeated params, because they are short and stay readable. Parsing is total and forgiving: unknown brands, unknown colour families, unparseable numbers and unknown sort keys all fall back to their default rather than throwing, because packs do disappear from this catalog — ranks 7 and 16 are absent by decision (ADR-033) — and an old bookmark should degrade, not error.

**2. Brands are filtered by slug, colours by their union member.** `?brand=peak-design` rather than `?brand=Peak%20Design`: the slug survives a brand restyling its own name (`TOM BIHN` today, `Tom Bihn` tomorrow) and keeps the URL readable. Colour needs no such treatment because `ColorFamily` values are already lowercase kebab-case, which is why ADR-022 chose them that way.

**3. Filter changes use `router.replace`, not `push`.** Otherwise every keystroke in the search box becomes a history entry and the back button walks backwards through the letters of a search term instead of leaving the catalog. Navigating into a pack and back still restores the filtered view, because the replaced entry is the one being returned to.

**4. The query is ignored until `onMounted` — the hydration gate.** `nuxt generate` prerenders `/` with no query string and there is no server at runtime, so `/?brand=aer` is served that same file. The client resolves its route from the real URL and knows the query on its first render, before hydration, so filtering immediately would make the first client render disagree with the prerendered markup. The composable therefore reports `DEFAULT_FILTERS` until mounted. The cost is a brief flash of the full catalog when opening a filtered link; the alternative is a hydration mismatch, which discards the server DOM and re-renders anyway, more slowly and with a console error.

**5. `CatalogToolbar` takes no props and emits nothing.** It calls `useCatalogFilters()` itself, exactly as the page does, and the two agree because they are reading the same URL rather than because state was passed between them. Props here would create a second, weaker source of truth. `FacetCheckboxGroup` is the exception and the codebase's first `defineEmits`: it is generic over two different facets, holds no state, and emits a `toggle` rather than taking a `v-model` array, which would have it recomputing `toggleFacet` locally.

**6. Colour facets are all 13 `ColorFamily` members, including zero-count ones, and facet counts are over the whole catalog.** Deriving the facet list from the ingested data is precisely the failure ADR-022 exists to prevent — the filter's vocabulary would shrink and grow with the data. `white` currently has a count of 0 and stays selectable: "no packs are white" is a true answer to a question a user is allowed to ask, and disabling the box hides it. Counts are computed from the full catalog rather than from the current results so the numbers do not shift underneath a user mid-selection, and a pack with three black colorways counts once for `black`.

> **Correction, 2026-09-03.** The count half of this point is **superseded by ADR-035**: facet counts were removed from the UI and are no longer computed, so there is no whole-catalog-versus-current-results question left to answer. The `Facet` type carries a value and a label only. The rest of the point stands unchanged and is the more important half — colour facets are still all 13 `ColorFamily` members in `COLOR_FAMILIES` order, built from the closed union and never from the data, and `white` still renders and is still selectable despite matching nothing. The honest cost of the removal is recorded in ADR-035: `white` is now visually indistinguishable from a facet that matches packs, because the number was the only thing that distinguished it.

**7. Every score comparison goes through `normalizeScore`; nothing displays it.** This is ADR-010 restated where it is now actually implemented — the `score-desc` sort and the minimum-rating filter both divide by `review.scale`. The rating filter's facets are therefore percentages of each pack's own scale (`70%+`, `75%+`…) rather than absolute scores, because "8.0+" would mean two different things across a catalog carrying both 5.0 and 10.0 sources. Sorting on the raw score would put every 10.0-scale pack above every 5.0-scale one: TOM BIHN's 4.9/5.0 is 0.98 and outranks three packs at 8.6/10.0. Every comparator also falls back to `rank` so the order is total and deterministic rather than depending on `Array.prototype.sort` stability over an input whose order changes with the filters.

**8. `/pack/[slug]` is prerendered by link crawling, not by a route manifest.** The index renders a `<NuxtLink>` per pack — that is what the `to` prop deferred in ADR-024 was for — and `nitro.prerender.crawlLinks` follows them, emitting 17 pages. No route list is generated into `nuxt.config.ts`, so there is nothing to drift from the catalog. **The dependency is real and worth knowing:** the crawl sees whatever `/` renders at build time, which is the unfiltered catalog precisely because filters are gated behind hydration (point 4). A future default that hides packs on first render would silently stop generating their pages. `pnpm generate` reporting 17 `/pack/…` routes is the check.

**9. The detail route reuses the blocks but not the card's constraints.** `PriceBlock` and `ScoreBlock` are used verbatim — they take primitives for exactly this reason (`docs/component-conventions.md`). `ColorwayGrid` is **not**: its 8 cells and `>` pager exist because a card has room for 8 (ADR-015), and a page with room for all 13 should not hide 5 behind a pager. Likewise the gallery is not a carousel — `PackGallery` shows all 1-5 photographs at once, which is more useful and carries no state, no wrap arithmetic and no controls to make accessible. The `Pack*` prefix means "detail route only", mirroring `Card*`.

**Consequences:**
- Adding a filter means adding a query key in `app/utils/catalog.ts` and nothing else; the composable and toolbar read the same encoder.
- `app/data/catalog.ts` is now the **only** module that imports `catalog.json`, so the one `as unknown as Backpack[]` cast lives in one place. The cast is safe because `scripts/build-catalog.ts` zod-validates before writing (ADR-025); re-validating in the browser would ship zod to the client to re-check a bundled build artifact.
- Runtime imports **between** modules in `app/utils/` are relative (`./format`), not `~/utils/format`. Ratified as a convention in its own right by **ADR-035**, which states the rule, its scope and the alternative rejected; cite that rather than this bullet.
- `pnpm test` still has no coverage of `app/utils/catalog.ts`. That module is pure and was written to be tested; the boundary cases worth naming are the default round trip (`parse(encode(defaults))` is empty), a `maxPrice` at or above the catalog ceiling normalizing to `null`, a hand-edited URL with an unknown brand and an unknown colour, and `score-desc` ordering a 4.9/5.0 above an 8.6/10.0.

## ADR-035 — Sibling imports inside `app/utils/` are relative; facet counts are gone
**2026-09-03 · Accepted · Amends ADR-034 points 6 and its import consequence**

Two Phase 6 follow-ups the repo owner settled after review. They are unrelated to each other except in provenance: both were buried inside ADR-034 and both are things later phases have to cite.

**1. A runtime import between two modules in `app/utils/` is written relatively (`./format`), never `~/utils/format`.** The scope is exactly that: siblings inside `app/utils/`. **`~` remains the norm everywhere else in `app/`** — components and pages import `~/utils/catalog`, `~/types/backpack`, `~/data/catalog` as before, and should keep doing so. The reason is that `~` is a **Vite** resolution supplied by Nuxt, not a Node one. Nothing outside the Nuxt build resolves it. `app/utils/` is the one directory in this app that is pure, Vue-free and worth loading outside the build — by a bare `vitest` run, or by `node --experimental-strip-types` — and a relative specifier is what keeps it loadable there with no runner configuration at all. That is the arrangement Phase 7 inherits: the existing unit tests import `../../app/utils/…` and run with no `vitest.config.ts` in the repo. The type-only `~` imports that predate this rule are not exceptions to it — `import type` is erased before anything has to resolve it, so it never reaches a resolver in the first place.

**Rejected: add a `vitest.config.ts` with a `~` alias.** It would work, and it is the wrong trade. It adds a configuration file whose only purpose is to make the test runner agree with the bundler about one character, it is build-tooling territory rather than frontend's to add (`build-tooling-specialist` owns runner config), and it makes the tests depend on config being correct in order to resolve an import that could simply have been correct on its own. A relative path costs a few characters and needs nothing to be true.

> **Correction, 2026-09-03.** A `vitest.config.ts` **now exists**, added when Playwright landed (ADR-037). The rejection above still stands in substance and the relative-import rule is unchanged — that file adds **no `resolve.alias`**, so nothing in `app/utils/` resolves through configuration and a relative specifier is still the only thing making these imports work. What is now false is the narrower claim in point 1 that the unit tests "run with no `vitest.config.ts` in the repo": they do not, because Vitest 4's default `include` glob matches `tests/e2e/*.spec.ts` and would otherwise drag Playwright specs into the Vitest runner. The config exists to keep the two runners apart, which is a different question from module resolution. If that file is ever deleted or given an alias, this rule is what is at stake: **an alias in it would reverse the decision above, an `exclude` in it does not.**

**Consequence: `app/utils/` intentionally differs from the rest of `app/`, and that is not drift.** Anyone tidying imports for consistency will find this directory and want to "fix" it. It is fixed. The comment at the top of `app/utils/catalog.ts` says so at the point of use.

**2. Filter facet counts are removed entirely — from the UI and from the computation.** ADR-034 point 6 shipped a per-option pack count computed over the whole catalog. The alternatives on review were: keep them catalog-wide, make them narrow with the current results, or drop them. Dropping won. A catalog-wide number answers a question nobody asked — "how many packs are olive, ignoring the four filters I have set?" — and a results-narrow number shifts underneath the user as they select, which is precisely why ADR-034 made them catalog-wide in the first place. Neither variant earns the row of digits it costs. `Facet<T>` is now `{ value, label }`; `colorFacets` reads nothing from the packs and takes no argument, and `brandFacets` still walks the catalog because the brand vocabulary genuinely comes from the data — it collects distinct brands and their labels, it just no longer tallies them.

**What did not change, and must not.** The colour facet list is still all 13 `ColorFamily` members in `COLOR_FAMILIES` order, built from the closed union and never from the data (ADR-022). `white` matches zero packs, still renders, and is still selectable. No facet is ever disabled. The zero-count muting (`text-card-muted`) went with the counts, because with no count there is nothing to key it off — and it must not come back as a disabled control or as a data-derived list used to detect emptiness, either of which would reintroduce ADR-022's failure through the back door. The result count above the grid — the toolbar's `role="status"` live region reading "Showing N of M packs" — is not a facet count and is untouched.

**The honest cost.** There is now no way to tell from the UI that `white` matches nothing. Ticking it empties the grid, and the only feedback is the result count going to zero. That is a real regression in discoverability, accepted knowingly: an empty result set is legible feedback, and it costs one click to learn something that a permanent `0` was charging every user a column of noise to display.

**Accessibility note.** The removed count carried an `sr-only` "pack"/"packs" noun so the bare digit read as something aloud. Removing it makes each checkbox's accessible name the label alone — `"Aer"`, `"White"` — which is strictly better than `"Aer 3 packs"`, not worse. The `<fieldset>`/`<legend>` still supplies the group name, so the full announcement is unchanged apart from the dropped number.

## ADR-036 — The URL codec is lossless; price bounds and step guarantee reachability; `minScore` is a closed set
**2026-09-03 · Accepted · Amends ADR-034 (the URL codec) and ADR-035 (the toolbar's facets); the score rule of ADR-010 is untouched**

Phase 7's first unit test file over `app/utils/catalog.ts` failed 16 assertions, every one of them against application code rather than the tests. The fixes are in `app/utils/catalog.ts`, `app/components/CatalogToolbar.vue`, `app/composables/useCatalogFilters.ts` and `app/data/catalog.ts`. Five decisions came out of it that later work has to respect.

**1. `q` round trips verbatim; trimming happens at the point of use.** `catalogQueryParams` and `parseCatalogQuery` both used to `.trim()` the search term, which made the codec lossy in a way the user could feel: the toolbar binds its input to a draft and re-syncs that draft from the committed filters whenever the two differ, so typing `peak ` and pausing had the debounce commit `peak `, the codec return `peak`, and the watcher delete the space from under the cursor mid-word. The codec no longer touches the payload. Trimming stays exactly where it already lived and already means something — `matchesSearch` splits on `/\s+/` and drops empties, and `isDefaultFilters` / `activeFilterCount` compare `filters.q.trim()` — because trimming is a rule about what a *search* means, not about what a URL can carry. The accepted cost is that a trailing space is visible in the URL as `?q=peak+`. A whitespace-only term remains no search at all: it parses to `''`, is omitted from the query entirely, and `isDefaultFilters` still calls it default.

**Rejected: also `.trim()` the toolbar's re-sync comparison (`if (q.trim() !== searchDraft.value.trim())`).** It would mask the same symptom, and doing both is worse than doing either: the comparison would then be defending against a disagreement the codec can no longer produce, and the next person to read it would have no way to tell whether the codec or the watcher is the thing keeping the input stable. One fix, at the layer that was wrong.

**2. Both price bounds round *up*, and the asymmetry is load-bearing.** `priceBounds` returned `floor(min)`, which reads like widening and is the opposite. Every value on that slider is consumed as a **ceiling** — `filterBackpacks` rejects a pack when `amountUsd > maxPrice` — so with a cheapest pack at $79.95, `min = 79` made the slider's leftmost position match **zero of 17 packs**, excluding the very pack it was derived from. `Math.ceil` on both ends is what makes the function's own promise ("the cheapest and most expensive packs are always inside the range") true at both ends. Anything else added to this module that consumes a bound as a floor must revisit this, not assume it.

**3. `PRICE_STEP` is exported from `app/utils/catalog.ts`, and `bounds.max` is reachable from `bounds.min` in whole steps.** The toolbar hard-coded `step="5"` in its markup while the bounds were computed elsewhere, so the two could disagree with nothing failing — and they did: `79 + 5n` tops out at 524 against a `max` of 525, which filtered out the $525 Mission Workshop Rhake LS at the thumb's rightmost position and made `commitPrice`'s `priceDraft >= bounds.max` branch — the one that clears the filter back to "No maximum", along with the matching `aria-valuetext` and `<output>` — unreachable. `priceBounds` now rounds `max` up to a whole number of `PRICE_STEP`s above `min`, and `CatalogToolbar` binds `:step="PRICE_STEP"`. **The invariant to preserve: `(bounds.max - bounds.min) % PRICE_STEP === 0`, and every selectable position matches at least one pack.** Changing the step alone is safe; changing how either bound is computed is not, unless this still holds. Phase 7's unit tests assert it directly.

**4. `minScore` accepts only a `SCORE_THRESHOLDS` member, or `null`.** The parser used to take any `0 < n <= 1` while the encoder wrote `toFixed(2)`, so `?minScore=0.756` meant `0.756` on first read and `0.76` after one pass through the codec — the same URL meaning different things depending on how many times it had been encoded. Worse, the rating radios test `filters.minScore === threshold`, so an off-grid value rendered with **nothing selected** while actively removing packs, and no control on the page could clear it. `minScore` is now treated the way an unknown sort key or an unknown brand slug already was: **a value that is not one of the offered thresholds is not a filter, and falls back to `null`.** Snapping to the nearest threshold was the alternative and was rejected — it silently changes what a shared or hand-edited URL asks for (`?minScore=0.5` would become a stricter 70% filter), whereas dropping it degrades to the unfiltered catalog, which is what the rest of the forgiving parse already does. Because the accepted set is closed and every member is exact at two decimals, `toFixed(2)` is now a lossless encoding rather than a rounding step.

**5. `maxPrice` is clamped first and tested against the ceiling second.** The guard ran `rawMaxPrice < bounds.max` *before* `Math.round`, so `?maxPrice=524.6` passed it and then rounded to `525` — the ceiling itself. `activeFilterCount` reported a filter, the URL was rewritten as `maxPrice=525`, and the next parse normalized that to `null`. Clamping into range and then applying `>= bounds.max → null` restores the module's stated round-trip property. **Order matters here and the two steps must not be reordered back.**

**Also in this change, both without unit tests.** `useCatalogFilters.commit` merged its patch over `filters.value`, which is derived from `route.query` — and `router.replace` is async, so two commits in one tick (a debounced search landing while a checkbox is ticked, a slider `change` on the same tick as a sort change) both read the pre-navigation query and the second silently discarded the first. `commit` now merges onto a module-local in-flight accumulator, cleared when the navigation settles under an identity check so a later commit is not cleared by an earlier one; the facet toggles and `reset` go through the same base for the same reason. It is not unit-testable without `@nuxt/test-utils` and `happy-dom`, which are deliberately not being added — it becomes E2E-observable when Playwright lands. Separately, `catalogByRank` in `app/data/catalog.ts` was exported and unused while `app/pages/pack/[slug].vue` re-derived the identical sort inline; the export is **kept** and the page now imports it, rather than the reverse, because rank order is the catalog's canonical ordering (ADR-018) over a frozen build-time import — it is a module constant, not per-instance derived state — and this is the one place its "ranks are sparse, never index by rank" caveat is written down.

## ADR-037 — The two test runners are separated by directory, and Playwright owns `tests/e2e/`
**2026-09-03 · Accepted · Amends ADR-035's "no `vitest.config.ts`" claim**

Phase 7 needed a browser runner for the behaviours the plan's Verification section lists as observable only in a browser — the card's 5:7 box and its 65/15/20 band split, carousel wraparound by position rather than by named control, the colorway pager staying in cell 8, and the label's text and bounding box being identical across every image in a carousel. `@playwright/test` **1.62.1** is pinned exactly, Chromium only, and it pulls no TypeScript of its own, so the 6.0.3 ceiling (ADR-006) was never under pressure. Cross-browser was not adopted: nothing here is a rendering-engine question, and three engines would triple the wall clock to re-answer the same layout assertions.

**The runners must not glob into each other, and this is not hypothetical.** Vitest 4's default `include` is `**/*.{test,spec}.?(c|m)[jt]s?(x)` and its default `exclude` is only `node_modules` and `.git`. Before this change there was no `vitest.config.ts` at all, so the first `tests/e2e/*.spec.ts` file to land would have been collected by `pnpm test`, which would then have tried to import `@playwright/test` into the Vitest runner and failed. Both directions are now pinned: `vitest.config.ts` excludes `tests/e2e/**` (plus `.nuxt`, `.output`, `dist` and `.ingest-cache`, which Vitest 4 no longer excludes for you), and `playwright.config.ts` sets `testDir: './tests/e2e'` so Playwright cannot see `tests/unit`.

**Vitest's `include` deliberately stays broad.** Narrowing it to `tests/unit/**` would have been the smaller-looking config and is the worse one: a colocated `app/utils/foo.test.ts` would then silently never run, and a test that does not run is more dangerous than a glob that matches nothing. Only `tests/e2e/**` is carved out.

**`webServer` runs `pnpm dev`, on a port that was verified rather than assumed.** `nuxt.config.ts` sets no `devServer`, and the dev server was observed on `http://localhost:3000`. `reuseExistingServer: !process.env.CI` keeps a developer's already-running server rather than fighting it. The consequence worth knowing: **the E2E suite exercises the dev server, not `nuxt generate` output.** Prerendered SSG remains covered only by the plan's manual checklist, so a defect that appears only in static output — a hydration mismatch that the dev server papers over, most plausibly — would not be caught here.

**Consequences:**
- `npx playwright test` stays the documented command; `pnpm test:e2e` is an alias added alongside it, not a replacement.
- `pnpm install` does **not** fetch browser binaries. A fresh clone needs `npx playwright install chromium` once, which is now in the README.
- `npx playwright test` exits 1 on an empty suite. `--pass-with-no-tests` was deliberately not added to `test:e2e`, so the script and the bare command behave identically.
- ADR-035's rejection of a `vitest.config.ts` is narrowed, not reversed — see the correction on that entry. An `exclude` is fine; a `resolve.alias` would reverse it.
- Ranks 7 and 16 being absent (ADR-033) means the E2E suite asserts against 17 packs. The unit suite pins the same figure in `data-contract.test.ts`, so a re-ingest that changes the count fails loudly in one place rather than quietly skewing browser assertions.

**One pre-existing defect was found and fixed on the way in.** `pnpm-lock.yaml` still carried an importer entry `vue-router: specifier ^4.5.1 → version 4.6.4` from when `vue-router` was a direct dependency. `package.json` had already dropped it, but the lockfile was never regenerated, so the root `node_modules/vue-router` resolved to **4.6.4 while Nuxt 4.5.2 uses 5.3.1** — exactly the silent downgrade ADR-006 warns about, already in the tree. Re-resolving removed it; `pnpm why vue-router` now reports a single `5.3.1` via nuxt. **Anything typed against `vue-router` before 2026-09-03 may have been checked against v4.**

## ADR-038 — Band 3 is equal thirds, each cell centres its own content, dividers run the full band height
**2026-09-03 · Accepted · Refines ADR-021**

The card's meta row shipped with **nothing controlling horizontal alignment at all**. The container was `grid-cols-[auto_1fr_1fr] items-center` with no `justify-items-*` and no `text-*`, so every cell fell back to CSS defaults: cells stretched, text inherited `text-align: start`, and `ColorwayGrid`'s `w-fit` grid pinned to the start edge of its flex column. The swatches hugged the left edge with the price butted against them. Nobody chose that; it was the absence of a choice, which is why `docs/component-conventions.md` now states the rule rather than leaving it implicit.

**1. `grid-cols-3`, not `[auto_1fr_1fr]`.** Column 1 was `auto` — sized to exactly the 68px swatch grid, so there was no room inside it to centre anything. Equal thirds gives every cell slack. Measured: 86/86/86 at the 260px minimum card, 106/106/106 at the 320px maximum.

**2. Cells stretch; each centres its own content. `justify-items-center` is wrong here.** That would shrink-wrap each cell box to its content, and `truncate` needs a box *narrower* than its text to ellipsize — the price, retailer, score and source all depend on it. So the cells stay stretched and `text-center` does the work inside them. **This is the trap in this band:** the obvious utility silently disables truncation, and the failure is invisible until a long retailer name overflows its card.

**3. Vertical centring moved out of the container and into the cells.** The container's `items-center` shrink-wrapped each cell to its content height — 32px inside a 72px band, measured — so a `border-l` divider would have rendered as a short stub floating mid-band. Dropping `items-center` lets cells fill the band (71px of 72px, the 1px being the top border) and the dividers meet the top border and the card's bottom edge. `ColorwayGrid` gained `justify-center` to keep its own vertical centring; `PriceBlock` and `ScoreBlock` already had it.

**4. `px-1` on the cells, and never more than `px-2`.** Padding sits on the cells rather than the container for a reason that is easy to state wrongly: it is **not** about the dividers' vertical extent (that is point 3). With `px-3` on the container the rules land at thirds of the *padded box* — 12px inboard of the thirds of the card — and with a `gap` the whole gap falls on one side of each rule. Both have to go for the rules to sit on the card's actual thirds.

**`px-2` is a hard ceiling, and exceeding it breaks ADR-015.** At the 260px card the tracks are 86px and the swatch grid's min-content width is 68px (4 × 14 + 3 × 4). `86 − 2p ≥ 68` gives `p ≤ 9px`, so `px-2` leaves 1px a side and `px-2.5` makes the `w-fit` grid overflow cell 1 and cross the first divider — with cells visibly clipped. This fails **only** at the narrowest card, so a later "let it breathe" tweak will look perfectly fine in review at 320px. Do not raise it without re-measuring at a 292px viewport.

`px-1` specifically, over `px-1.5`, was chosen by measurement: at the 260px card `px-1.5` newly clipped the Rhake LS's `Nomads Nation` review source, which had fit before by under a pixel. `px-1` leaves the set of clipped strings **identical to the pre-change baseline at both 260px and 320px** — several retailers and one long source were already ellipsizing and still are. Price and score never ellipsize at any width, before or after. The rule for anyone retuning this: re-measure against the baseline, do not eyeball it.

**5. `PriceBlock` and `ScoreBlock` are styled at the call site, never internally.** Both are also used by `app/pages/pack/[slug].vue`, and `component-conventions` holds that the detail route does not inherit the card's constraints. The centring and the dividers are card decisions, so they are passed as fallthrough `class` from `BackpackCard`. `ColorwayGrid` is edited directly because it is card-only — the detail route deliberately renders its own colorway list.

**Deliberately not adopted from the reference screenshot:** the **3×3 / 9-cell swatch grid** and the **star icon** on the score. The 8-cell grid with the pager in cell 8 is ADR-015 and is unchanged; the reference came from a different implementation of this app, not from this codebase. Do not treat that screenshot as a spec for the swatch grid.

**Consequences:**
- Band 3's height is unchanged — it comes from the `20fr` track, not its content, so `tests/e2e/card-geometry.spec.ts` is unaffected and stayed green.
- **Keep `grid-cols-3` as the utility.** Tailwind v4 emits it as `repeat(3, minmax(0, 1fr))`, and that `0` minimum is what makes the thirds immune to the swatch grid's 68px min-content floor. Hand-writing it as `grid-cols-[repeat(3,1fr)]` restores the automatic `auto` minimum and the columns stop being equal at narrow widths.
- **Band 3 must keep exactly three direct `div` children, in order.** `tests/e2e/helpers.ts` `scoreText` reaches the score as band 3's third child. Wrapping a cell — for a divider, say — silently retargets that helper rather than failing loudly.
- Band 3 no longer shares band 2's `px-3` gutter, so the swatches start closer to the card edge than the model name above them. That is inherent to centring in thirds: the content cannot both sit on the card's thirds and align to band 2's gutter.
- `tests/e2e/colorways.spec.ts` compares the swatch grid's `width × height` and not its x position, so centring did not disturb it. **Nothing asserts the columns are equal or that content is centred** — that gap is what let the original misalignment ship, and it is worth a spec.
