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

**`app/data/catalog.json` is now gitignored.** ADR-012 and ADR-014 both already state it is a build artifact that a fresh clone must regenerate, but `.gitignore` never said so and Phase 4 was the first run that produced one. Implemented, not decided anew.

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
