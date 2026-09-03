# Component conventions

What the Phase 3 card components actually do. Written after building them, from the code — not a
style guide aspiration. Where a rule has an exception in the code, the exception is named.

Read this before writing or modifying a Vue component. `docs/decisions.md` carries the *why* behind
the geometry and interaction rules these conventions serve; this file is about how the code is
organized.

---

## File layout

```
app/components/*.vue    flat, no subdirectories — 6 components today
app/utils/*.ts          pure functions, one module per concern
app/pages/*.vue         routes
```

`app/components/` is flat and un-namespaced. Nuxt auto-imports by filename, so `BackpackCard.vue`
is `<BackpackCard>`; a subdirectory would change that to `<CardBackpackCard>`-style prefixing for no
benefit at this size. Revisit above ~15 components.

## Naming

- **Components** are `PascalCase.vue`, named after the thing they render, not their position:
  `PriceBlock`, not `CardColumn2`. Every card-only component starts with `Card*` (`CardCarousel`,
  `CardLabel`) **except** `ColorwayGrid`, `PriceBlock`, and `ScoreBlock`, which are named after
  their content because the Phase 6 detail route (`/pack/[slug]`) will reuse them outside a card.
  That split is deliberate: the `Card*` prefix means "only makes sense inside a card".
- **Utils** are `camelCase` verbs or nouns, exported individually — no default exports anywhere in
  the codebase, so every import is greppable by name.
- **Constants** shared with a component are `SCREAMING_SNAKE` and live in the util that owns the
  rule (`COLORWAY_CELLS` in `utils/cycle.ts`, `CARD_IMAGE_SIZES` in `utils/image.ts`).

## Props

- **`<script setup lang="ts">` with a type-only `defineProps<{...}>()`.** No runtime `props: {}`
  objects, no `withDefaults` yet (nothing has needed a default).
- **Only `BackpackCard` takes a whole `Backpack`.** Every leaf takes primitives — `PriceBlock` takes
  `amountUsd` and `retailer`, not `price: Backpack['price']`. This keeps leaves reusable from the
  detail route and from tests without constructing a partial `Backpack`, and it makes each
  component's real dependency visible in its signature. `CardCarousel` is the exception: it takes
  `images: CarouselImage[]`, because the array *is* the primitive there.
- **Optional props are genuinely optional**, not defaulted to a placeholder. `to?: string` on
  `BackpackCard`/`CardLabel` is unset in Phase 3 and the component renders plain text instead of a
  link — see "Deferred navigation" below.
- **Every interactive component takes `label: string`** (the full "Brand Model" string) purely to
  build accessible names. Twenty cards on one page means "Next image" alone is ambiguous in a
  screen reader's control list; "Next image of Aer Travel Pack 3" is not.
- No `emits` anywhere yet, and no slots. Both were considered for card navigation and neither earned
  its keep — the card is a fixed composition, not a layout container.

## Logic placement

**Pure logic lives in `app/utils/`, is imported explicitly, and is called from the template.**
Components hold rendering and `ref`/`computed` state only. The rule of thumb used here: if it has a
boundary case worth a unit test, it is not allowed in an SFC.

| Module | Owns |
| --- | --- |
| `utils/format.ts` | price, score display, normalized score, spoken score label |
| `utils/color.ts` | `ColorFamily` list, labels, free-form name → family |
| `utils/cycle.ts` | wrapping index arithmetic; the whole colorway-page render model |
| `utils/image.ts` | `srcset`/`src` construction from `CarouselImage`, `sizes` value |

The plan listed only `{format,color}.ts`; `cycle.ts` and `image.ts` were added while building and
the plan's file listing was updated to match (ADR-024).

**Imports are explicit** (`import { formatPrice } from '~/utils/format'`) even though Nuxt
auto-imports `app/utils/`. Auto-import is left on, but relying on it makes call sites unsearchable
and hides which module a helper came from. Components are the exception — those are used from
templates via Nuxt's component auto-import, with no import statement, which is the framework's
idiom and consistent across every SFC here.

`colorwayPage()` returns a whole render model (`items` / `ghostCells` / `hasPager` / `page` /
`pageCount`) rather than exposing three separate helpers. That shape is what makes the ADR-015
invariant checkable in one place: `items.length + ghostCells + (hasPager ? 1 : 0) === 8`.

## State

Local `ref` per card, per ADR-004. `CardCarousel` owns `index`, `ColorwayGrid` owns `page`, and
neither is lifted or persisted — a card that scrolls out of view and remounts starts over, which is
intended. Nothing is stored in a composable yet; `useCatalogFilters` arrives in Phase 6.

## Styling

- **Tailwind utilities in the template.** No `<style>` block exists in any component, and none
  should: there is no scoped CSS in this codebase.
- **Theme tokens (`@theme` in `app/assets/css/main.css`) are semantic colours only**, and only where
  a value is shared by more than one component: `card-surface`, `card-border`, `card-muted`,
  `swatch-ghost`. Everything else uses stock Tailwind palette values inline.
- **Geometry and type sizes stay literal in the SFC** — `aspect-[5/7]`, `grid-rows-[65fr_15fr_20fr]`,
  `min-w-[260px] max-w-[320px]`, `text-[10px]`. ADR-021 specifies those exact values, and hiding them
  behind a token would mean nobody can check the card against the ADR by reading the card.
- **`fr`, never `%`, for the band split** — and `min-h-0 overflow-hidden` on every band. This second
  half is load-bearing and easy to miss: an `fr` track still has an automatic min-content floor, so
  without `min-h-0` on the grid item a tall child can stretch its band and break 65/15/20. `fr`
  alone is not sufficient.
- Mobile-first: the only responsive modifier used is `sm:` on two type sizes. The card itself does
  not respond to viewport at all — it is pinned to 260–320px everywhere, and the *page* grid
  (`repeat(auto-fill, minmax(260px, 320px))`) is what reflows.

## Accessibility

- **Every control is a real `<button type="button">` with an `aria-label`.** There are exactly three
  per card: two full-height carousel halves and the colorway pager. No click handlers on divs.
- **Keyboard**: ArrowLeft/ArrowRight are bound on the carousel *container*, not on a `tabindex`
  wrapper, so the event bubbles from whichever zone button has focus. This adds arrow-key support
  without adding a tab stop. `focus-visible` outlines on all three controls.
- **`aria-live="polite"`** regions announce both cyclable states: "Image 3 of 5" in `CardCarousel`,
  "Colorway page 2 of 3" in `ColorwayGrid`. Both regions are present in the initial DOM (empty when
  there is nothing to announce), because a live region injected at the same time as its text is not
  reliably announced.
- **Two patterns for screen-reader text**, used deliberately:
  - `<span class="sr-only">` *added* alongside visible text, for context words the sighted reader
    infers from position (`"Price "`, `"at "` in `PriceBlock`).
  - visible text `aria-hidden="true"` and a full sentence in `sr-only` *instead*, where the visible
    form reads badly aloud. Only `ScoreBlock` does this: "4.4/5.0" is announced as "4.4 slash 5" by
    some readers, so `scoreSpokenLabel()` supplies "Rated 4.4 out of 5.0 by REI" and the source line
    is `aria-hidden` to avoid saying "REI" twice.
- Ghost swatch cells are `aria-hidden="true"` — they are padding, not content. Real swatches carry
  their name and family as `sr-only` text plus a `title` for mouse users.
- The card is an `<article>` with `aria-label="Brand Model"`, and the model name is an `<h3>`.

## Card-specific rules that are not negotiable

These are ADR-enforced; a change here needs an ADR, not a code review.

- Three bands, `65fr / 15fr / 20fr`, `aspect-[5/7]` (ADR-021).
- Nothing overlays the photo. The label is in band 2, a different grid row. Not "positioned
  carefully" — structurally elsewhere. The one thing inside band 1 besides the image and its click
  zones is the dot strip, and it is in its own row *below* the image, not on top of it.
- The dot row renders even for single-image packs (as an empty 16px row), so the image region is
  identical in height on every card. Dots are indicators only; the click zones navigate.
- The colorway grid renders exactly 8 cells, always. The pager sits in cell 8 on every page,
  including a partial final one (ADR-015).
- Everything cyclable wraps by modulo; no control is ever `disabled` (ADR-016).
- Display uses raw `score`/`scale`; sorting and filtering use `normalizeScore()` (ADR-010).

## Deferred navigation (Phase 3 state, and why)

The card renders **no link to `/pack/[slug]`**, because that route does not exist yet and
`nitro.prerender.crawlLinks` would try to prerender a 404. Instead `BackpackCard` and `CardLabel`
take an optional `to`, and the model name becomes a `<NuxtLink>` the moment it is supplied. Phase 6
passes `` :to="`/pack/${pack.slug}`" `` and nothing else changes.

Consequences to know about:
- Navigation is the **name link**, not a whole-card click handler or a stretched overlay. A
  stretched link would have to cover band 1 and would eat the carousel's click zones.
- `ColorwayGrid`'s pager still calls `stopPropagation()`, as ADR-015 requires, even though there is
  currently no ancestor handler for it to stop. It is a guard for the Phase 6 card-body handler, and
  the comment in the code says so — do not delete it as dead code.

## Testing hooks

No `data-testid` attributes were added. The Phase 7 E2E assertions (band ratios, 8 cells, wrap
behaviour) are all reachable via role and accessible name, which is a stronger check because it
fails if accessibility regresses. Add a testid only when a selector is genuinely unreachable that
way, and note why.
