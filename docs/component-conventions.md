# Component conventions

What the components actually do. Written after building them, from the code — not a style guide aspiration. Where a rule has an exception in the code, the exception is named. Phase 3 established this from the six card components; Phase 6 extended it with the toolbar, the composable and the detail route, and the additions are marked where they change a rule rather than add to it.

Read this before writing or modifying a Vue component. `docs/decisions.md` carries the *why* behind the geometry and interaction rules these conventions serve; this file is about how the code is organized.

---

## File layout

```
app/components/*.vue          flat, no subdirectories — 9 components today
app/composables/*.ts          URL-backed state; one file
app/utils/*.ts                pure functions, one module per concern
app/data/catalog.ts           the only module that imports catalog.json
app/pages/*.vue               routes
app/pages/pack/[slug].vue     the detail route
```

`app/components/` is flat and un-namespaced. Nuxt auto-imports by filename, so `BackpackCard.vue` is `<BackpackCard>`; a subdirectory would change that to `<CardBackpackCard>`-style prefixing for no benefit at this size. Revisit above ~15 components.

## Naming

- **Components** are `PascalCase.vue`, named after the thing they render, not their position: `PriceBlock`, not `CardColumn2`. Every card-only component starts with `Card*` (`CardCarousel`, `CardLabel`) **except** `ColorwayGrid`, `PriceBlock`, and `ScoreBlock`, which are named after their content because the detail route (`/pack/[slug]`) reuses them outside a card. That split is deliberate: the `Card*` prefix means "only makes sense inside a card". **`Pack*` is the same idea for the detail route**: `PackGallery` only makes sense there. Everything else — `CatalogToolbar`, `FacetCheckboxGroup` — is named after what it is.
- Phase 6 confirmed the split was worth having: `PriceBlock` and `ScoreBlock` were reused on the detail route unchanged, and `ColorwayGrid` deliberately was **not** (see "Card-specific rules" below).
- **Utils** are `camelCase` verbs or nouns, exported individually — no default exports anywhere in the codebase, so every import is greppable by name.
- **Constants** shared with a component are `SCREAMING_SNAKE` and live in the util that owns the rule (`COLORWAY_CELLS` in `utils/cycle.ts`, `CARD_IMAGE_SIZES` in `utils/image.ts`).

## Props

- **`<script setup lang="ts">` with a type-only `defineProps<{...}>()`.** No runtime `props: {}` objects, no `withDefaults` yet (nothing has needed a default).
- **Only `BackpackCard` takes a whole `Backpack`.** Every leaf takes primitives — `PriceBlock` takes `amountUsd` and `retailer`, not `price: Backpack['price']`. This keeps leaves reusable from the detail route and from tests without constructing a partial `Backpack`, and it makes each component's real dependency visible in its signature. `CardCarousel` is the exception: it takes `images: CarouselImage[]`, because the array *is* the primitive there.
- **Optional props are genuinely optional**, not defaulted to a placeholder. `to?: string` on `BackpackCard`/`CardLabel` is unset in Phase 3 and the component renders plain text instead of a link — see "Deferred navigation" below.
- **Every interactive component takes `label: string`** (the full "Brand Model" string) purely to build accessible names. Twenty cards on one page means "Next image" alone is ambiguous in a screen reader's control list; "Next image of Aer Travel Pack 3" is not.
- **`CatalogToolbar` takes no props at all.** It calls `useCatalogFilters()` itself, exactly as `app/pages/index.vue` does; the two stay in sync because they read the same URL, not because anything is passed between them (ADR-034). Props would be a second, weaker source of truth alongside the query string. Anything reading catalog state should follow this rather than accepting it as a prop.
- **One `emits`, no slots.** `FacetCheckboxGroup` emits `toggle: [value: string]` — it is generic over two different facets (brands, colours), holds no state, and reports an intent rather than taking a `v-model` array it would then have to recompute. Everything else still emits nothing; the card is a fixed composition, not a layout container.

## Logic placement

**Pure logic lives in `app/utils/`, is imported explicitly, and is called from the template.** Components hold rendering and `ref`/`computed` state only. The rule of thumb used here: if it has a boundary case worth a unit test, it is not allowed in an SFC.

| Module | Owns |
| --- | --- |
| `utils/format.ts` | price, score display, normalized score, spoken score label |
| `utils/color.ts` | `ColorFamily` list, labels, free-form name → family |
| `utils/cycle.ts` | wrapping index arithmetic; the whole colorway-page render model |
| `utils/image.ts` | `srcset`/`src` construction from `CarouselImage`, `sizes` values for both the card and the detail gallery |
| `utils/catalog.ts` | search matching, filtering, sorting, facet building, price bounds, URL query encode/decode |

The plan listed only `{format,color}.ts`; `cycle.ts` and `image.ts` were added while building and the plan's file listing was updated to match (ADR-024).

**Imports are explicit** (`import { formatPrice } from '~/utils/format'`) even though Nuxt auto-imports `app/utils/` and `app/composables/`. Auto-import is left on, but relying on it makes call sites unsearchable and hides which module a helper came from. Components are the exception — those are used from templates via Nuxt's component auto-import, with no import statement, which is the framework's idiom and consistent across every SFC here.

**Runtime imports between siblings inside `app/utils/` are relative** — `import { normalizeScore } from './format'`, not `'~/utils/format'`. `~` is a Vite/Nuxt resolution, not a Node one; the `~` imports that predate this rule are all `import type` and were erased before anything had to resolve them. `utils/catalog.ts` is the first module to import another util at runtime, and a relative path keeps `app/utils/` loadable by a bare `vitest` run and by `node --experimental-strip-types` without a runner config. Everywhere else — components, pages, composables — keeps `~`. Ratified as **ADR-035**, including the rejected alternative (a `vitest.config.ts` alias); this one directory differing from the rest of `app/` is deliberate, not drift.

`colorwayPage()` returns a whole render model (`items` / `ghostCells` / `hasPager` / `page` / `pageCount`) rather than exposing three separate helpers. That shape is what makes the ADR-015 invariant checkable in one place: `items.length + ghostCells + (hasPager ? 1 : 0) === 8`.

## State

There are exactly two kinds, and no store (ADR-004).

**Local `ref` per card.** `CardCarousel` owns `index`, `ColorwayGrid` owns `page`, and neither is lifted or persisted — a card that scrolls out of view and remounts starts over, which is intended.

**The URL, via `useCatalogFilters`.** Search, filters and sort live in `route.query` and nowhere else, so a filtered view is bookmarkable and survives a reload. The composable is plumbing only: every rule about what matches, what sorts and how a param is spelled is in `~/utils/catalog`, which is pure and free of Vue. ADR-034 records the encoding (defaults are omitted from the URL, lists are comma-separated, brands are slugs, writes use `replace` not `push`).

**Two local-draft patterns exist in `CatalogToolbar`, and both are deliberate.** The search input and the price range bind to a local `ref` and commit to the URL late — the search on a 200ms idle, the range on `@change` rather than `@input`. Without them, a `router.replace` runs per keystroke and per pixel of thumb drag. Both drafts are re-synced from `filters` by a watcher, so Back, "Clear all" and a chip removal all reach the control.

**A draft's re-sync watcher compares raw values, and the codec is what keeps them comparable.** The search watcher is a plain `if (q !== searchDraft.value)`: the URL codec round trips `q` verbatim (ADR-036), so the committed value and the draft can no longer differ by whitespace alone. Do not add a `.trim()` to that comparison — it would be defending against a disagreement the codec cannot produce, and it would leave the next reader unable to tell which of the two is keeping the input stable. The same rule generalises: if a new draft/commit pair drifts, fix the codec, not the comparison.

**The price slider's `step` is bound from `PRICE_STEP` in `~/utils/catalog`, never written as a literal.** `priceBounds` guarantees `max` is a whole number of steps above `min`, which is what makes the rightmost thumb position equal `bounds.max` — and therefore what makes the "No maximum" branch, its `aria-valuetext` and its `<output>` reachable at all (ADR-036). A hard-coded `step` in the markup can drift out of that agreement with nothing failing; that is exactly what it did.

**The hydration gate.** `useCatalogFilters` reports `DEFAULT_FILTERS` until `onMounted`. The site is prerendered with no query string and there is no server at runtime, so a client that read `?brand=aer` on its first render would disagree with the served HTML. See ADR-034 point 4 — if you add UI that reads the query, it must be gated the same way or it will reintroduce the mismatch.

## Styling

- **Tailwind utilities in the template.** No `<style>` block exists in any component, and none should: there is no scoped CSS in this codebase.
- **Theme tokens (`@theme` in `app/assets/css/main.css`) are semantic colours only**, and only where a value is shared by more than one component: `card-surface`, `card-border`, `card-muted`, `swatch-ghost`. Everything else uses stock Tailwind palette values inline.
- **Geometry and type sizes stay literal in the SFC** — `aspect-[5/7]`, `grid-rows-[65fr_15fr_20fr]`, `min-w-[260px] max-w-[320px]`, `text-[10px]`. ADR-021 specifies those exact values, and hiding them behind a token would mean nobody can check the card against the ADR by reading the card.
- **`fr`, never `%`, for the band split** — and `min-h-0 overflow-hidden` on every band. This second half is load-bearing and easy to miss: an `fr` track still has an automatic min-content floor, so without `min-h-0` on the grid item a tall child can stretch its band and break 65/15/20. `fr` alone is not sufficient.
- Mobile-first: on the card the only responsive modifier is `sm:` on two type sizes. The card itself does not respond to viewport at all — it is pinned to 260–320px everywhere, and the *page* grid (`repeat(auto-fill, minmax(260px, 320px))`) is what reflows. The toolbar and detail route do respond, with `sm:`/`md:`/`lg:` column counts, because neither has fixed geometry to protect.

## Accessibility

- **Every control is a real `<button type="button">` with an `aria-label`.** There are exactly three per card: two full-height carousel halves and the colorway pager. No click handlers on divs. The toolbar is built from native form controls for the same reason — `<input type="search">`, `<select>`, `<input type="checkbox">`, `<input type="radio">`, `<input type="range">` — each of which carries its own state, label association and keyboard behaviour. Nothing is a styled `div`.
- **The filter panel is a native `<details>`/`<summary>`**, and there is one of them rather than four popovers. That buys the disclosed/expanded state, keyboard operation and Escape handling for free, and avoids click-outside handling, a focus trap, z-index stacking and two panels overlapping each other. It works before hydration. The cost is that opening it pushes the grid down, which is predictable and reversible.
- **No filter facet is ever disabled, and none carries a count.** A `Facet` is `{ value, label }` — the per-option pack count was removed outright (ADR-035). Colour facets are still all 13 `ColorFamily` members from the closed union, so `white` renders and is selectable even though it matches nothing; the checkbox's accessible name is its label alone. Do not reintroduce a count, a muted style for empty options, or a disabled control: "no packs are white" is a true answer to a question a user is allowed to ask, and the empty result set is the feedback.
- **The result count is the toolbar's `role="status"`**, which is an implicit polite live region. It is the only feedback a screen-reader user gets that a filter applied, so it must stay in the DOM and stay populated — do not `v-if` it away when the list is empty.
- **Active filters are mirrored as removable chips** outside the disclosure, so a filtered view is legible with the panel shut. Each chip is a `<button>` reading "Remove filter: Aer".
- **Keyboard**: ArrowLeft/ArrowRight are bound on the carousel *container*, not on a `tabindex` wrapper, so the event bubbles from whichever zone button has focus. This adds arrow-key support without adding a tab stop. `focus-visible` outlines on all three controls.
- **`aria-live="polite"`** regions announce both cyclable states: "Image 3 of 5" in `CardCarousel`, "Colorway page 2 of 3" in `ColorwayGrid`. Both regions are present in the initial DOM (empty when there is nothing to announce), because a live region injected at the same time as its text is not reliably announced.
- **Two patterns for screen-reader text**, used deliberately:
  - `<span class="sr-only">` *added* alongside visible text, for context words the sighted reader infers from position (`"Price "`, `"at "` in `PriceBlock`).
  - visible text `aria-hidden="true"` and a full sentence in `sr-only` *instead*, where the visible form reads badly aloud. Only `ScoreBlock` does this: "4.4/5.0" is announced as "4.4 slash 5" by some readers, so `scoreSpokenLabel()` supplies "Rated 4.4 out of 5.0 by REI" and the source line is `aria-hidden` to avoid saying "REI" twice.
- Ghost swatch cells are `aria-hidden="true"` — they are padding, not content. Real swatches carry their name and family as `sr-only` text plus a `title` for mouse users.
- The card is an `<article>` with `aria-label="Brand Model"`, and the model name is an `<h3>`.

## Card-specific rules that are not negotiable

These are ADR-enforced; a change here needs an ADR, not a code review.

- Three bands, `65fr / 15fr / 20fr`, `aspect-[5/7]` (ADR-021).
- Nothing overlays the photo. The label is in band 2, a different grid row. Not "positioned carefully" — structurally elsewhere. The one thing inside band 1 besides the image and its click zones is the dot strip, and it is in its own row *below* the image, not on top of it.
- The dot row renders even for single-image packs (as an empty 16px row), so the image region is identical in height on every card. Dots are indicators only; the click zones navigate.
- The colorway grid renders exactly 8 cells, always. The pager sits in cell 8 on every page, including a partial final one (ADR-015).
- **Band 3 is `grid-cols-3`; its cells stretch and each centres its own content (ADR-038).** Never `justify-items-center` on the band container — that shrink-wraps each cell to its content and silently disables the `truncate` on the price, retailer, score and source, which only shows up when a long retailer name overflows. Use `text-center` inside a stretched cell instead. Vertical centring lives in the cells, not the container, so their `border-l` dividers span the full band height rather than floating as stubs; horizontal padding lives on the cells for the same reason. `PriceBlock` and `ScoreBlock` take these as fallthrough `class` from `BackpackCard` and are never styled internally, because the detail route uses them too (see the rule below). **Cell padding is capped at `px-2`:** at the 260px card the tracks are 86px against a 68px swatch grid, so more than 9px a side overflows cell 1 across the divider and breaks the 8-cell rule above — and it only fails at the narrowest card, so it will look fine in review. Retuning it also changes what ellipsizes there; measure against the current baseline rather than eyeballing it.
- Everything cyclable wraps by modulo; no control is ever `disabled` (ADR-016).
- Display uses raw `score`/`scale`; sorting and filtering use `normalizeScore()` (ADR-010). `ScoreBlock` is the only component that formats a score and it never compares one; `utils/catalog.ts` is the only module that compares one and it never formats.
- **The detail route does not inherit the card's constraints.** `ColorwayGrid`'s 8 cells and `>` pager exist because a *card* has room for 8; `/pack/[slug]` has room for all 13 and renders a plain list, because paging there would hide data for no reason. `PackGallery` is not a carousel for the same reason: all 1–5 photographs fit, so there is no index to wrap and no control to make accessible. Reuse a card component on the detail route only where its constraint still applies.

## Navigation to the detail route

Phase 3 left `to` unset because `/pack/[slug]` did not exist and `nitro.prerender.crawlLinks` would have tried to prerender a 404. Phase 6 passes `` :to="`/pack/${pack.slug}`" `` from the index page and nothing else about the card changed — which was the point of the deferral.

Consequences to know about:
- Navigation is the **name link**, not a whole-card click handler or a stretched overlay. A stretched link would have to cover band 1 and would eat the carousel's click zones.
- **Those links are how the detail pages get generated.** There is no prerender route list; `crawlLinks` follows what `/` renders at build time, which is the unfiltered catalog precisely because filters are gated behind hydration. A default that hid packs on first render would silently stop generating their pages. `pnpm generate` reporting one `/pack/…` route per pack is the check (ADR-034 point 8).
- `ColorwayGrid`'s pager still calls `stopPropagation()`, as ADR-015 requires, even though the card has no ancestor click handler. It is a guard against one being added — do not delete it as dead code.

## Testing hooks

No `data-testid` attributes were added, on the card or on the toolbar. The Phase 7 E2E assertions (band ratios, 8 cells, wrap behaviour) are all reachable via role and accessible name, which is a stronger check because it fails if accessibility regresses — and the toolbar is the same: every control has a visible or `sr-only` label, so `getByLabel('Search')`, `getByRole('checkbox', { name: 'Aer' })` and `getByRole('status')` are all that is needed. Add a testid only when a selector is genuinely unreachable that way, and note why.
