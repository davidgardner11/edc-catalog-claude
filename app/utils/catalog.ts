import type { Backpack, ColorFamily } from '~/types/backpack'
// Sibling utils are imported RELATIVELY, not via `~/utils/...`. These are the
// first runtime (non-type-only) imports between modules in `app/utils/`, and
// the `~` alias is a Nuxt/Vite resolution, not a Node one — a relative path
// keeps this module graph loadable by a plain `vitest` run and by
// `node --experimental-strip-types`, neither of which is alias-aware, without
// adding a runner config. Type-only imports still use `~` because they are
// erased before anything resolves them.
import { COLOR_FAMILIES, colorFamilyLabel } from './color'
import { normalizeScore } from './format'

/**
 * Search, filter and sort for the catalog grid — the whole rule set, pure and
 * free of Vue.
 *
 * `app/composables/useCatalogFilters.ts` is only the URL plumbing around this
 * module: it reads `route.query`, calls `parseCatalogQuery` here, and writes
 * `catalogQueryParams` back. Everything with a boundary case — the empty query,
 * an unknown facet value, an out-of-range price, the normalized score
 * comparison — is here so it is unit-testable without mounting anything, per
 * the logic-placement rule in `docs/component-conventions.md`.
 *
 * **The score rule (ADR-010).** `review.scale` is 5.0 for retailer reviews and
 * 10.0 for enthusiast sites, so raw `score` is not comparable across packs:
 * 4.9/5.0 (0.98) beats 8.6/10.0 (0.86) but loses on the raw number. Every
 * comparison in this module goes through `normalizeScore`. Display never does.
 */

export type SortKey = 'rank' | 'price-asc' | 'price-desc' | 'score-desc'

export const SORT_OPTIONS = [
  { value: 'rank', label: 'Acclaim rank' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'score-desc', label: 'Rating: high to low' },
] as const satisfies ReadonlyArray<{ value: SortKey; label: string }>

export const DEFAULT_SORT: SortKey = 'rank'

function isSortKey(value: string): value is SortKey {
  return SORT_OPTIONS.some((option) => option.value === value)
}

/**
 * `maxPrice` and `minScore` are `null` when unset rather than sentinel numbers,
 * so "no ceiling" is never confused with "ceiling happens to equal the most
 * expensive pack" — the second is a filter the user set and the URL should
 * record; the first is not.
 */
export type CatalogFilters = {
  /** Free text over brand and model name. */
  q: string
  /** Brand *slugs* (see `brandSlug`), not display names. */
  brands: string[]
  families: ColorFamily[]
  /** Inclusive USD ceiling. */
  maxPrice: number | null
  /** Inclusive floor on `score / scale`, 0-1 (ADR-010). Never a raw score. */
  minScore: number | null
  sort: SortKey
}

export const DEFAULT_FILTERS: CatalogFilters = {
  q: '',
  brands: [],
  families: [],
  maxPrice: null,
  minScore: null,
  sort: DEFAULT_SORT,
}

/** True when nothing is set — i.e. the URL should carry no catalog params. */
export function isDefaultFilters(filters: CatalogFilters): boolean {
  return (
    filters.q.trim() === '' &&
    filters.brands.length === 0 &&
    filters.families.length === 0 &&
    filters.maxPrice === null &&
    filters.minScore === null &&
    filters.sort === DEFAULT_SORT
  )
}

/** How many *filters* are active. Sort is an ordering, not a filter, so it is excluded. */
export function activeFilterCount(filters: CatalogFilters): number {
  return (
    (filters.q.trim() === '' ? 0 : 1) +
    filters.brands.length +
    filters.families.length +
    (filters.maxPrice === null ? 0 : 1) +
    (filters.minScore === null ? 0 : 1)
  )
}

/**
 * `"Peak Design"` -> `"peak-design"`, `"The Brown Buffalo"` -> `"the-brown-buffalo"`.
 *
 * Brands are filtered by slug rather than display name so the URL stays
 * readable and stable: `?brand=peak-design` survives a brand rendering its own
 * name in a new case (`TOM BIHN` vs `Tom Bihn`), which display-name matching
 * would not. Slugs are only ever produced from catalog data and compared with
 * each other, so this never has to round-trip back to a display name — the
 * facet list carries the label.
 */
export function brandSlug(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * One selectable filter option: the value that goes in the URL, and the label
 * shown beside its checkbox.
 *
 * **There is deliberately no `count`** (ADR-035). Phase 6 carried a
 * whole-catalog tally per option; it was dropped because a catalog-wide number
 * answers a question nobody asked ("how many packs are olive, ignoring my other
 * filters?") while a results-narrow one shifts underneath a user mid-selection.
 * The honest cost is that `white`, which matches nothing, now looks exactly like
 * a facet that matches packs.
 */
export type Facet<T extends string> = {
  value: T
  label: string
}

/**
 * Brand facets, alphabetical by display label, case-insensitively.
 *
 * The **vocabulary comes from the data**: a brand exists as a filter because a
 * pack in the catalog carries it. That is the opposite of `colorFacets` below,
 * and the difference is why these stay two functions despite returning the same
 * shape.
 */
export function brandFacets(packs: readonly Backpack[]): Facet<string>[] {
  const byslug = new Map<string, Facet<string>>()
  for (const pack of packs) {
    const value = brandSlug(pack.brand)
    // First pack to name a brand supplies its display label; later ones add
    // nothing, so the whole loop is a distinct-brand collection.
    if (!byslug.has(value)) byslug.set(value, { value, label: pack.brand })
  }
  return [...byslug.values()].sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
}

/**
 * Colour facets are **exactly the 13 `ColorFamily` members** (ADR-022), in
 * `COLOR_FAMILIES` order, including members no pack currently carries.
 *
 * The **vocabulary comes from the closed union**, never from the packs. Deriving
 * it from the data would make the filter's vocabulary shrink and grow as packs
 * are ingested, which is the precise failure ADR-022 exists to prevent. `white`
 * matches zero packs today and still renders, still selectable: "no packs are
 * white" is a true answer to a question a user is allowed to ask, and no facet
 * is ever disabled. It takes no catalog argument at all — with the count gone
 * there is nothing left here that the packs could inform, and a parameter that
 * is accepted and ignored would invite someone to start reading it.
 */
export function colorFacets(): Facet<ColorFamily>[] {
  return COLOR_FAMILIES.map((value) => ({ value, label: colorFamilyLabel(value) }))
}

export type PriceBounds = { min: number; max: number }

/**
 * The price slider's step, in whole dollars. **Exported so the toolbar binds it
 * rather than hard-coding `step="5"`** (ADR-036): the step and the bounds
 * together decide which ceilings a user can actually select, so a literal in the
 * markup and the arithmetic here could silently disagree.
 */
export const PRICE_STEP = 5

/**
 * Whole-dollar bounds for the price slider. Computed from the **full** catalog,
 * never from the filtered results, so the slider's track does not move
 * underneath the thumb as other filters change.
 *
 * Both bounds round **up**, and that asymmetry is the point (ADR-036). Every
 * value on this slider is consumed as a *ceiling* — `filterBackpacks` rejects a
 * pack when `amountUsd > maxPrice` — so `floor`ing the low bound would narrow
 * the range rather than widen it: with a $79.95 cheapest pack, `min = 79` is a
 * leftmost position that matches nothing at all. `ceil` on both ends is what
 * makes "the cheapest and most expensive packs are always inside the range"
 * true at both ends.
 *
 * `max` is then pushed up to a whole number of `PRICE_STEP`s above `min`, so
 * `max` is itself reachable from `min` in whole steps. Without that, the thumb
 * at full right lands below `max` — leaving the dearest pack filtered out and
 * the toolbar's "No maximum" branch (`priceDraft >= bounds.max`) unreachable.
 */
export function priceBounds(packs: readonly Backpack[]): PriceBounds {
  if (packs.length === 0) return { min: 0, max: 0 }
  const amounts = packs.map((pack) => pack.price.amountUsd)
  const min = Math.ceil(Math.min(...amounts))
  const dearest = Math.ceil(Math.max(...amounts))
  return { min, max: min + Math.ceil((dearest - min) / PRICE_STEP) * PRICE_STEP }
}

/** Selectable floors for the rating filter, as fractions of each pack's own scale. */
export const SCORE_THRESHOLDS: readonly number[] = [0.7, 0.75, 0.8, 0.85, 0.9]

/** `0.75` -> `"75%"`. The rating filter's only display rule. */
export function formatScoreThreshold(threshold: number): string {
  return `${Math.round(threshold * 100)}%`
}

/**
 * Case-insensitive AND-of-terms over `"Brand Name"`. Splitting on whitespace is
 * what makes `"aer city"` and `"city aer"` both find the City Pack Pro 2 — a
 * single substring test would match neither.
 */
export function matchesSearch(pack: Backpack, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = `${pack.brand} ${pack.name}`.toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

export function filterBackpacks(packs: readonly Backpack[], filters: CatalogFilters): Backpack[] {
  const brands = new Set(filters.brands)
  const families = new Set<ColorFamily>(filters.families)

  return packs.filter((pack) => {
    if (!matchesSearch(pack, filters.q)) return false
    if (brands.size > 0 && !brands.has(brandSlug(pack.brand))) return false
    // OR within the colour facet: a pack matches if ANY of its colorways is in
    // the selected set. AND would mean "available in black AND olive", which is
    // not what a shopper ticking two colours is asking.
    if (families.size > 0 && !pack.colorways.some((colorway) => families.has(colorway.family))) return false
    if (filters.maxPrice !== null && pack.price.amountUsd > filters.maxPrice) return false
    // ADR-010: normalized, never the raw score.
    if (filters.minScore !== null && normalizeScore(pack.review.score, pack.review.scale) < filters.minScore) {
      return false
    }
    return true
  })
}

/**
 * Total order. Every comparator falls back to `rank`, so the output is fully
 * deterministic even where two packs share a price or a normalized score —
 * relying on `Array.prototype.sort` stability would make the result depend on
 * the input order, and the input order changes with the filters.
 */
export function sortBackpacks(packs: readonly Backpack[], sort: SortKey): Backpack[] {
  const byRank = (a: Backpack, b: Backpack) => a.rank - b.rank
  const sorted = [...packs]

  switch (sort) {
    case 'price-asc':
      return sorted.sort((a, b) => a.price.amountUsd - b.price.amountUsd || byRank(a, b))
    case 'price-desc':
      return sorted.sort((a, b) => b.price.amountUsd - a.price.amountUsd || byRank(a, b))
    case 'score-desc':
      // ADR-010 again, and this is the sort the ADR was written about: sorting
      // on `score` alone puts every 10.0-scale pack above every 5.0-scale one.
      return sorted.sort(
        (a, b) =>
          normalizeScore(b.review.score, b.review.scale) - normalizeScore(a.review.score, a.review.scale) ||
          byRank(a, b),
      )
    case 'rank':
    default:
      return sorted.sort(byRank)
  }
}

export function applyCatalogFilters(packs: readonly Backpack[], filters: CatalogFilters): Backpack[] {
  return sortBackpacks(filterBackpacks(packs, filters), filters.sort)
}

/* -------------------------------------------------------------------------- */
/* URL query encoding (ADR-034)                                               */
/* -------------------------------------------------------------------------- */

/** Query parameter names, in the order they are written to the URL. */
export const QUERY_KEYS = ['q', 'brand', 'color', 'maxPrice', 'minScore', 'sort'] as const

/** A `LocationQuery` value: string, null, or a repeated-param array of those. */
type QueryValue = string | null | undefined | (string | null)[]

/** Last-wins for a repeated param, so `?sort=rank&sort=price-asc` is not a crash. */
function readParam(query: Record<string, QueryValue>, key: string): string {
  const raw = query[key]
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw
  return typeof value === 'string' ? value : ''
}

/** Comma-separated lists, deduplicated, empties dropped, unknown values dropped. */
function readList(query: Record<string, QueryValue>, key: string, allowed: ReadonlySet<string>): string[] {
  const parts = readParam(query, key)
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part !== '' && allowed.has(part))
  return [...new Set(parts)]
}

/**
 * Read filters out of a route query. **Total and forgiving**: a hand-edited or
 * stale URL never throws and never yields an out-of-range filter — unknown
 * brands, unknown colour families, unparseable numbers and unknown sort keys
 * all fall back to their default. A bookmark that silently drops one dead facet
 * is better than a page that errors, and packs do disappear: ranks 7 and 16 are
 * absent by decision (ADR-033) and any pack can be retired between visits.
 *
 * Takes the catalog rather than a bounds object because both allowlists it
 * needs — the brand slugs and the price ceiling — are properties of the data. A
 * `maxPrice` at or above the catalog ceiling is not a filter at all, and
 * normalizing it to `null` here is what keeps `parse -> encode` a round trip:
 * the encoder would have dropped it anyway.
 */
export function parseCatalogQuery(
  query: Record<string, QueryValue>,
  packs: readonly Backpack[],
): CatalogFilters {
  const bounds = priceBounds(packs)
  const brands = new Set(packs.map((pack) => brandSlug(pack.brand)))
  const families = new Set<string>(COLOR_FAMILIES)

  const rawSort = readParam(query, 'sort').trim()
  const rawQ = readParam(query, 'q')
  const rawMaxPrice = Number.parseFloat(readParam(query, 'maxPrice'))
  const rawMinScore = Number.parseFloat(readParam(query, 'minScore'))

  return {
    // Lossless (ADR-036): whatever the user typed survives the round trip,
    // including the space after a word they are still typing. A whitespace-only
    // term is the one exception — it carries no search, so it collapses to the
    // default and drops out of the URL entirely. Trimming for *matching* happens
    // in `matchesSearch` / `isDefaultFilters` / `activeFilterCount`.
    q: rawQ.trim() === '' ? '' : rawQ,
    brands: readList(query, 'brand', brands),
    families: readList(query, 'color', families) as ColorFamily[],
    maxPrice: readMaxPrice(rawMaxPrice, bounds),
    minScore: readMinScore(rawMinScore),
    sort: isSortKey(rawSort) ? rawSort : DEFAULT_SORT,
  }
}

/**
 * Clamp into the slider's range, **then** test against the ceiling — in that
 * order (ADR-036). Testing first lets `?maxPrice=524.6` through the guard and
 * rounds it up to the ceiling afterwards, producing a "filter" the encoder
 * writes as `maxPrice=525` and the next parse discards: the same URL meaning two
 * different things depending on how many times it has been through the codec.
 */
function readMaxPrice(raw: number, bounds: PriceBounds): number | null {
  if (!Number.isFinite(raw)) return null
  const ceiling = Math.max(bounds.min, Math.round(raw))
  return ceiling >= bounds.max ? null : ceiling
}

/**
 * `minScore` is a **closed set**, not a range (ADR-036): the only values the
 * rating radios can render as selected are `SCORE_THRESHOLDS`, which they test
 * with `===`. Anything else is treated like an unknown sort key or an unknown
 * brand slug and falls back to the default, rather than becoming a filter that
 * removes packs with no control showing it as set and none able to clear it.
 * Being a closed set is also what makes `toFixed(2)` a lossless encoding.
 */
function readMinScore(raw: number): number | null {
  if (!Number.isFinite(raw)) return null
  // Tolerance, not `===`: the value has been through `toFixed(2)` and back, and
  // decimal fractions do not survive that bit-identically in general.
  return SCORE_THRESHOLDS.find((threshold) => Math.abs(threshold - raw) < 1e-9) ?? null
}

/**
 * Encode filters as a query object. **A parameter at its default value is
 * omitted entirely** (ADR-034) rather than written as `q=` or `sort=rank`, so
 * the unfiltered catalog is `/` with a clean URL and every param present in a
 * URL is one the user actually chose.
 *
 * `undefined` — not `''` — is the removal signal vue-router understands.
 */
export function catalogQueryParams(filters: CatalogFilters): Record<string, string | undefined> {
  return {
    // Written verbatim, not trimmed (ADR-036). The toolbar re-syncs its input
    // from the committed value, so a codec that rewrites its payload would edit
    // the box under the user's cursor mid-word. `?q=peak+` in the URL is the
    // accepted cost. A whitespace-only term is still no search, so it is omitted.
    q: filters.q.trim() === '' ? undefined : filters.q,
    brand: filters.brands.length > 0 ? [...filters.brands].join(',') : undefined,
    color: filters.families.length > 0 ? [...filters.families].join(',') : undefined,
    maxPrice: filters.maxPrice === null ? undefined : String(filters.maxPrice),
    // Two decimals: the parser only ever yields a `SCORE_THRESHOLDS` member
    // (0.70-0.90), all of which are exact at two places, so this is lossless.
    // `String(0.7000000001)` in a URL would be an eyesore that also breaks
    // equality with the radio it is supposed to select.
    minScore: filters.minScore === null ? undefined : filters.minScore.toFixed(2),
    sort: filters.sort === DEFAULT_SORT ? undefined : filters.sort,
  }
}

/**
 * Toggle a value in a facet selection, preserving order of first selection so
 * the URL does not churn when a box is unticked and reticked.
 */
export function toggleFacet<T extends string>(selected: readonly T[], value: T): T[] {
  return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
}
