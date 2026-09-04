import { describe, expect, it } from 'vitest'
import type { Backpack, ColorFamily } from '../../app/types/backpack'
import { catalogBackpacks } from '../../app/data/catalog'
import { fixtureBackpacks } from '../../app/data/fixtures'
import { COLOR_FAMILIES, colorFamilyLabel } from '../../app/utils/color'
import { normalizeScore } from '../../app/utils/format'
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  QUERY_KEYS,
  SCORE_THRESHOLDS,
  SORT_OPTIONS,
  activeFilterCount,
  applyCatalogFilters,
  brandFacets,
  brandSlug,
  catalogQueryParams,
  colorFacets,
  filterBackpacks,
  formatScoreThreshold,
  isDefaultFilters,
  matchesSearch,
  parseCatalogQuery,
  priceBounds,
  sortBackpacks,
  toggleFacet,
} from '../../app/utils/catalog'
import type { CatalogFilters, SortKey } from '../../app/utils/catalog'

/**
 * `app/utils/catalog.ts` — search, filter, sort and the URL codec (ADR-034).
 *
 * These assertions are written from the module's stated contract — its own doc
 * comments, ADR-034 and ADR-035 — not from reading what the code currently
 * does. Several of them fail today; that is the point, and the failures are
 * catalogued in the Phase 7 defect report rather than being softened here.
 *
 * Two sources of packs are used deliberately:
 *
 * - **`fixtureBackpacks` and small hand-built packs** where the case is about a
 *   rule (both review scales, a rank tie-break) and a fixture states it more
 *   clearly than real data would.
 * - **`catalogBackpacks`, the real 17** where the bug depends on the real
 *   numbers. The price spread is the whole of the price-slider defect: the
 *   cheapest pack is **$79.95** (Osprey Daylite Plus) and the dearest is
 *   **$525.00** (Mission Workshop Rhake LS), and the bounds/step arithmetic is
 *   only wrong because those two figures are not whole dollars five apart.
 *
 * Imports are relative rather than `~/...` — ADR-035. Type-only imports may use
 * either, since they are erased before anything resolves them.
 */

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

/** A minimal valid `Backpack`; only the fields a rule reads are parameterised. */
function makePack(fields: {
  rank: number
  brand?: string
  name?: string
  price?: number
  score?: number
  scale?: number
  families?: ColorFamily[]
}): Backpack {
  const { rank, brand = 'Brand', name = `Pack ${rank}`, price = 100, score = 4, scale = 5 } = fields
  const families = fields.families ?? ['black']
  const slug = `${brandSlug(brand)}-${rank}`
  return {
    rank,
    slug,
    name,
    brand,
    images: [
      { base: `/images/${slug}/0`, widths: [640, 1280], width: 1280, height: 1280, alt: `${brand} ${name}` },
    ],
    colorways: families.map((family) => ({ name: family, hex: '#000000', family })),
    price: {
      amountUsd: price,
      retailer: 'Retailer',
      url: 'https://example.test/product',
      capturedAt: '2026-01-01T00:00:00.000Z',
    },
    review: {
      score,
      scale,
      source: 'Source',
      url: 'https://example.test/review',
      capturedAt: '2026-01-01T00:00:00.000Z',
    },
  }
}

const filters = (patch: Partial<CatalogFilters> = {}): CatalogFilters => ({ ...DEFAULT_FILTERS, ...patch })

const slugs = (packs: readonly Backpack[]) => packs.map((pack) => pack.slug)

const CHEAPEST_USD = 79.95
const DEAREST_USD = 525

describe('the catalog these tests are written against', () => {
  // Guards the tests below: they encode the real price spread by number, so a
  // re-ingest that changes it should fail here first, loudly, rather than
  // making the slider tests quietly meaningless.
  it('is the 17 ingested packs with a $79.95 floor and a $525.00 ceiling', () => {
    expect(catalogBackpacks).toHaveLength(17)
    const amounts = catalogBackpacks.map((pack) => pack.price.amountUsd)
    expect(Math.min(...amounts)).toBe(CHEAPEST_USD)
    expect(Math.max(...amounts)).toBe(DEAREST_USD)
  })
})

/* -------------------------------------------------------------------------- */
/* Slugs, search and facets                                                   */
/* -------------------------------------------------------------------------- */

describe('brandSlug', () => {
  it.each([
    ['Peak Design', 'peak-design'],
    ['The Brown Buffalo', 'the-brown-buffalo'],
    ['TOM BIHN', 'tom-bihn'],
    ['Tom Bihn', 'tom-bihn'],
    ['Chrome Industries', 'chrome-industries'],
    ['ALPAKA', 'alpaka'],
  ])('brandSlug(%j) === %j', (brand, expected) => {
    expect(brandSlug(brand)).toBe(expected)
  })

  it('is stable across a brand restyling its own name', () => {
    expect(brandSlug('TOM BIHN')).toBe(brandSlug('Tom Bihn'))
  })

  it('never emits a leading, trailing or doubled separator', () => {
    for (const pack of catalogBackpacks) {
      expect(brandSlug(pack.brand)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })
})

describe('matchesSearch', () => {
  const cityPack = catalogBackpacks.find((pack) => pack.slug === 'aer-city-pack-pro-2-20l')!

  it('matches terms in any order across brand and model name', () => {
    expect(matchesSearch(cityPack, 'aer city')).toBe(true)
    expect(matchesSearch(cityPack, 'city aer')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(matchesSearch(cityPack, 'AER CITY')).toBe(true)
  })

  it('is AND over terms, so one miss rejects the pack', () => {
    expect(matchesSearch(cityPack, 'aer goruck')).toBe(false)
  })

  it('matches everything on an empty or whitespace-only query', () => {
    expect(matchesSearch(cityPack, '')).toBe(true)
    expect(matchesSearch(cityPack, '   ')).toBe(true)
  })

  it('tolerates the whitespace a user types mid-term', () => {
    expect(matchesSearch(cityPack, 'aer  city ')).toBe(true)
  })
})

describe('brandFacets', () => {
  it('collects distinct brands — 17 packs, 16 brands, Aer appearing once', () => {
    const facets = brandFacets(catalogBackpacks)
    expect(facets).toHaveLength(16)
    expect(facets.filter((facet) => facet.value === 'aer')).toHaveLength(1)
    expect(new Set(facets.map((facet) => facet.value)).size).toBe(facets.length)
  })

  it('sorts by display label, case-insensitively', () => {
    const labels = brandFacets(catalogBackpacks).map((facet) => facet.label)
    const expected = [...labels].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    expect(labels).toEqual(expected)
    // The case that a case-sensitive sort gets wrong: "TOM BIHN" would land
    // before every lowercase-initial brand rather than beside "Topo Designs".
    expect(labels.indexOf('TOM BIHN')).toBe(labels.indexOf('Topo Designs') - 1)
  })

  it('carries a value and a label and nothing else — no count (ADR-035)', () => {
    for (const facet of brandFacets(catalogBackpacks)) {
      expect(Object.keys(facet).sort()).toEqual(['label', 'value'])
    }
  })

  it('returns nothing for an empty catalog', () => {
    expect(brandFacets([])).toEqual([])
  })
})

describe('colorFacets', () => {
  it('is exactly the 13 ColorFamily members in COLOR_FAMILIES order (ADR-022)', () => {
    expect(colorFacets()).toEqual(COLOR_FAMILIES.map((value) => ({ value, label: colorFamilyLabel(value) })))
    expect(colorFacets()).toHaveLength(13)
  })

  it('includes families no pack carries, and they stay selectable', () => {
    const white = colorFacets().find((facet) => facet.value === 'white')
    expect(white).toEqual({ value: 'white', label: 'White' })
    // No pack in the catalog is white; the facet exists anyway, and selecting
    // it is answerable with an empty grid rather than a disabled control.
    expect(filterBackpacks(catalogBackpacks, filters({ families: ['white'] }))).toEqual([])
  })

  it('carries a value and a label and nothing else — no count (ADR-035)', () => {
    for (const facet of colorFacets()) {
      expect(Object.keys(facet).sort()).toEqual(['label', 'value'])
    }
  })
})

describe('formatScoreThreshold', () => {
  it.each([
    [0.7, '70%'],
    [0.75, '75%'],
    [0.9, '90%'],
  ])('formatScoreThreshold(%f) === %j', (threshold, expected) => {
    expect(formatScoreThreshold(threshold)).toBe(expected)
  })
})

/* -------------------------------------------------------------------------- */
/* Price bounds and the slider's reachable positions                          */
/* -------------------------------------------------------------------------- */

describe('priceBounds', () => {
  it('returns whole dollars', () => {
    const bounds = priceBounds(catalogBackpacks)
    expect(Number.isInteger(bounds.min)).toBe(true)
    expect(Number.isInteger(bounds.max)).toBe(true)
  })

  it('is zero-width on an empty catalog rather than ±Infinity', () => {
    expect(priceBounds([])).toEqual({ min: 0, max: 0 })
  })

  it('is computed from the full catalog, so it does not move with the filters', () => {
    // Why `useCatalogFilters` passes the full catalog: bounds over the current
    // results would move the slider's track underneath the thumb.
    const cheap = filterBackpacks(catalogBackpacks, filters({ maxPrice: 200 }))
    expect(priceBounds(cheap)).not.toEqual(priceBounds(catalogBackpacks))
  })

  /**
   * The function's own doc comment: bounds are "widened outward … so the
   * cheapest and most expensive packs are always inside the range". `min` is
   * only ever consumed as a *ceiling* — `filterBackpacks` rejects a pack when
   * `amountUsd > maxPrice`, and the slider's leftmost position is `bounds.min`
   * — so widening it downward narrows the selectable range instead.
   */
  it('puts the cheapest pack inside the range at the slider’s leftmost position', () => {
    const bounds = priceBounds(catalogBackpacks)
    const matched = filterBackpacks(catalogBackpacks, filters({ maxPrice: bounds.min }))
    expect(slugs(matched)).toContain('osprey-daylite-plus-20l')
  })

  it('never yields a bound that matches zero packs', () => {
    const bounds = priceBounds(catalogBackpacks)
    expect(filterBackpacks(catalogBackpacks, filters({ maxPrice: bounds.min })).length).toBeGreaterThan(0)
    expect(filterBackpacks(catalogBackpacks, filters({ maxPrice: bounds.max }))).toHaveLength(
      catalogBackpacks.length,
    )
  })

  // The same property, stated without the real catalog: a fractional cheapest
  // price is the general case, not an Osprey quirk.
  it.each([79.95, 0.5, 129.99, 249.01])(
    'a lone pack priced $%f is inside its own bounds at both ends',
    (amount) => {
      const packs = [makePack({ rank: 1, price: amount })]
      const bounds = priceBounds(packs)
      expect(filterBackpacks(packs, filters({ maxPrice: bounds.min }))).toHaveLength(1)
      expect(filterBackpacks(packs, filters({ maxPrice: bounds.max }))).toHaveLength(1)
    },
  )
})

describe('the price slider’s reachable positions', () => {
  /**
   * `CatalogToolbar` binds `:min="bounds.min"` `:max="bounds.max"` with a
   * hard-coded `step="5"`, so the values a user can actually select are
   * `min + step·n`. Two things follow that the bounds have to guarantee, and
   * neither is checkable from the bounds alone.
   *
   * The constant below mirrors that literal because `app/utils/catalog.ts`
   * exports no step, which is itself part of the defect — the markup and the
   * bounds arithmetic are one decision held in two places that can silently
   * disagree. The fix should export the step and this should import it.
   */
  const PRICE_STEP = 5
  const bounds = priceBounds(catalogBackpacks)
  const highestSelectable = bounds.min + Math.floor((bounds.max - bounds.min) / PRICE_STEP) * PRICE_STEP

  it('reaches its own maximum in whole steps from its own minimum', () => {
    // Without this, `commitPrice`'s `priceDraft >= bounds.max` — the branch that
    // clears the filter back to "No maximum" — is unreachable, and so is the
    // "No maximum" label the slider claims to show at full right.
    expect((bounds.max - bounds.min) % PRICE_STEP).toBe(0)
    expect(highestSelectable).toBe(bounds.max)
  })

  it('has a rightmost position that matches every pack in the catalog', () => {
    expect(highestSelectable).toBeGreaterThanOrEqual(DEAREST_USD)
    expect(filterBackpacks(catalogBackpacks, filters({ maxPrice: highestSelectable }))).toHaveLength(
      catalogBackpacks.length,
    )
  })

  it('has no position that matches zero packs', () => {
    for (let value = bounds.min; value <= bounds.max; value += PRICE_STEP) {
      const matched = filterBackpacks(catalogBackpacks, filters({ maxPrice: value }))
      expect(matched.length, `slider at $${value} matches nothing`).toBeGreaterThan(0)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* filterBackpacks                                                            */
/* -------------------------------------------------------------------------- */

describe('filterBackpacks', () => {
  it('returns everything under the default filters', () => {
    expect(filterBackpacks(catalogBackpacks, DEFAULT_FILTERS)).toHaveLength(catalogBackpacks.length)
  })

  it('preserves input order — ordering is sortBackpacks’ job', () => {
    const input = [...catalogBackpacks].reverse()
    expect(slugs(filterBackpacks(input, DEFAULT_FILTERS))).toEqual(slugs(input))
  })

  it('filters brands by slug', () => {
    const matched = filterBackpacks(catalogBackpacks, filters({ brands: ['aer'] }))
    expect(slugs(matched).sort()).toEqual(['aer-city-pack-pro-2-20l', 'aer-travel-pack-3-small'])
  })

  it('ORs multiple brands', () => {
    const matched = filterBackpacks(catalogBackpacks, filters({ brands: ['aer', 'filson'] }))
    expect(matched).toHaveLength(3)
  })

  it('ORs colour families — a pack matches if ANY colorway is selected', () => {
    const matched = filterBackpacks(catalogBackpacks, filters({ families: ['purple'] }))
    expect(slugs(matched).sort()).toEqual(['peak-design-everyday-backpack-30l', 'tom-bihn-synapse-19'])

    const either = filterBackpacks(catalogBackpacks, filters({ families: ['purple', 'multi'] }))
    // Union, not intersection: no pack carries both purple and multi, so an AND
    // reading would return nothing here.
    expect(either.length).toBeGreaterThan(matched.length)
  })

  it('counts a pack once however many colorways of a family it carries', () => {
    const pack = makePack({ rank: 1, families: ['black', 'black', 'black'] })
    expect(filterBackpacks([pack], filters({ families: ['black'] }))).toHaveLength(1)
  })

  it('treats maxPrice as an inclusive ceiling', () => {
    const matched = filterBackpacks(catalogBackpacks, filters({ maxPrice: 285 }))
    expect(slugs(matched)).toContain('evergoods-civic-panel-loader-24l') // exactly $285
    expect(slugs(matched)).not.toContain('peak-design-everyday-backpack-30l') // $299.95
  })

  // ADR-010 / ADR-034 point 7: the rating filter is a fraction of each pack's
  // own scale, so a 10.0-scale pack at 8.6 (0.86) is below a 0.9 floor while a
  // 5.0-scale pack at 4.77 (0.954) is above it. Comparing raw scores would
  // invert this completely.
  it('applies minScore to score / scale, never the raw score', () => {
    const matched = filterBackpacks(catalogBackpacks, filters({ minScore: 0.9 }))
    expect(slugs(matched).sort()).toEqual([
      'able-carry-max-edc', // 4.8/5.0  = 0.96
      'black-ember-citadel-r3-25l', // 4.77/5.0 = 0.954
      'tom-bihn-synapse-19', // 4.9/5.0  = 0.98
    ])
    for (const pack of matched) {
      expect(normalizeScore(pack.review.score, pack.review.scale)).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('treats minScore as an inclusive floor', () => {
    const packs = [makePack({ rank: 1, score: 8, scale: 10 })]
    expect(filterBackpacks(packs, filters({ minScore: 0.8 }))).toHaveLength(1)
    expect(filterBackpacks(packs, filters({ minScore: 0.81 }))).toHaveLength(0)
  })

  it('ANDs across different facets', () => {
    const matched = filterBackpacks(
      catalogBackpacks,
      filters({ brands: ['aer'], families: ['olive'], maxPrice: 200 }),
    )
    expect(slugs(matched)).toEqual(['aer-city-pack-pro-2-20l'])
  })

  it('can return nothing without throwing', () => {
    expect(filterBackpacks(catalogBackpacks, filters({ q: 'no such pack anywhere' }))).toEqual([])
    expect(filterBackpacks([], DEFAULT_FILTERS)).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* sortBackpacks                                                              */
/* -------------------------------------------------------------------------- */

describe('sortBackpacks', () => {
  it('does not mutate its input', () => {
    const input = [...catalogBackpacks].reverse()
    const before = slugs(input)
    sortBackpacks(input, 'price-asc')
    expect(slugs(input)).toEqual(before)
  })

  it('orders by rank by default, gaps and all (ranks 7 and 16 are absent — ADR-033)', () => {
    const ranks = sortBackpacks(catalogBackpacks, 'rank').map((pack) => pack.rank)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(ranks).not.toContain(7)
    expect(ranks).not.toContain(16)
  })

  it('orders by price in both directions', () => {
    const asc = sortBackpacks(catalogBackpacks, 'price-asc').map((pack) => pack.price.amountUsd)
    expect(asc[0]).toBe(CHEAPEST_USD)
    expect(asc.at(-1)).toBe(DEAREST_USD)
    const desc = sortBackpacks(catalogBackpacks, 'price-desc').map((pack) => pack.price.amountUsd)
    expect(desc[0]).toBe(DEAREST_USD)
    expect(desc.at(-1)).toBe(CHEAPEST_USD)
  })

  /**
   * The sort ADR-010 was written about. TOM BIHN's 4.9/5.0 is 0.98 and must
   * outrank three packs at 8.6/10.0 (0.86). Sorting on `score` alone puts every
   * 10.0-scale pack above every 5.0-scale one, which reads as plausible until
   * you notice no five-point pack is ever near the top.
   */
  it('orders score-desc by score / scale, so 4.9/5.0 beats 8.6/10.0', () => {
    const sorted = sortBackpacks(catalogBackpacks, 'score-desc')
    expect(sorted[0]!.slug).toBe('tom-bihn-synapse-19')
    const normalized = sorted.map((pack) => normalizeScore(pack.review.score, pack.review.scale))
    expect(normalized).toEqual([...normalized].sort((a, b) => b - a))
  })

  it('prefers the higher normalized score even when rank disagrees', () => {
    // The 8.6/10.0 pack is rank 1 and would win any raw-score or rank fallback.
    const acclaimed = makePack({ rank: 1, brand: 'Ten Scale', score: 8.6, scale: 10 })
    const rated = makePack({ rank: 20, brand: 'Five Scale', score: 4.9, scale: 5 })
    expect(slugs(sortBackpacks([acclaimed, rated], 'score-desc'))).toEqual([rated.slug, acclaimed.slug])
  })

  it('treats equal ratios on different scales as equal, then falls back to rank', () => {
    const tenScale = makePack({ rank: 9, brand: 'Ten Scale', score: 8.8, scale: 10 })
    const fiveScale = makePack({ rank: 2, brand: 'Five Scale', score: 4.4, scale: 5 })
    expect(slugs(sortBackpacks([tenScale, fiveScale], 'score-desc'))).toEqual([fiveScale.slug, tenScale.slug])
  })

  // Totality: two packs share $285 (ranks 1 and 8) and three share 8.6/10.0
  // (ranks 1, 3 and 4), so the tie-break is exercised by the real catalog.
  it.each(['rank', 'price-asc', 'price-desc', 'score-desc'] as const)(
    'is a total order under %s — ties break by rank, not by input order',
    (sort) => {
      const forward = slugs(sortBackpacks(catalogBackpacks, sort))
      const reversed = slugs(sortBackpacks([...catalogBackpacks].reverse(), sort))
      const alphabetical = slugs(
        sortBackpacks([...catalogBackpacks].sort((a, b) => a.slug.localeCompare(b.slug)), sort),
      )
      expect(reversed).toEqual(forward)
      expect(alphabetical).toEqual(forward)
    },
  )

  it('breaks a price tie by rank', () => {
    const tied = catalogBackpacks.filter((pack) => pack.price.amountUsd === 285)
    expect(tied).toHaveLength(2)
    const order = slugs(sortBackpacks(catalogBackpacks, 'price-asc')).filter((slug) =>
      slugs(tied).includes(slug),
    )
    expect(order).toEqual(['evergoods-civic-panel-loader-24l', 'black-ember-citadel-r3-25l'])
  })

  it('falls back to rank for an unknown sort key', () => {
    expect(slugs(sortBackpacks(catalogBackpacks, 'nonsense' as SortKey))).toEqual(
      slugs(sortBackpacks(catalogBackpacks, 'rank')),
    )
  })
})

describe('applyCatalogFilters', () => {
  it('filters then sorts', () => {
    const result = applyCatalogFilters(fixtureBackpacks, filters({ maxPrice: 300, sort: 'price-asc' }))
    expect(result.map((pack) => pack.price.amountUsd)).toEqual([139, 249])
  })

  it('is the composition of its two halves', () => {
    const f = filters({ families: ['olive'], sort: 'score-desc' })
    expect(slugs(applyCatalogFilters(catalogBackpacks, f))).toEqual(
      slugs(sortBackpacks(filterBackpacks(catalogBackpacks, f), f.sort)),
    )
  })
})

/* -------------------------------------------------------------------------- */
/* URL codec (ADR-034)                                                        */
/* -------------------------------------------------------------------------- */

const parse = (query: Record<string, string | null | undefined | (string | null)[]>) =>
  parseCatalogQuery(query, catalogBackpacks)

const roundTrip = (f: CatalogFilters) => parse(catalogQueryParams(f))

describe('catalogQueryParams', () => {
  it('omits every parameter at its default — a default is an absent parameter', () => {
    const params = catalogQueryParams(DEFAULT_FILTERS)
    expect(Object.values(params).every((value) => value === undefined)).toBe(true)
    expect(Object.keys(params)).toEqual([...QUERY_KEYS])
  })

  it('omits sort when it is the default and writes it otherwise', () => {
    expect(catalogQueryParams(filters({ sort: DEFAULT_SORT })).sort).toBeUndefined()
    expect(catalogQueryParams(filters({ sort: 'price-asc' })).sort).toBe('price-asc')
  })

  it('writes lists as one comma-separated parameter', () => {
    expect(catalogQueryParams(filters({ families: ['black', 'olive'] })).color).toBe('black,olive')
    expect(catalogQueryParams(filters({ brands: ['aer', 'filson'] })).brand).toBe('aer,filson')
  })

  it('uses undefined, not empty string, as the removal signal', () => {
    expect(catalogQueryParams(DEFAULT_FILTERS).q).toBeUndefined()
    expect(catalogQueryParams(filters({ q: '   ' })).q).toBeUndefined()
  })
})

describe('parseCatalogQuery', () => {
  it('returns the defaults for an empty query', () => {
    expect(parse({})).toEqual(DEFAULT_FILTERS)
  })

  it('round trips the defaults to an empty query and back', () => {
    expect(roundTrip(DEFAULT_FILTERS)).toEqual(DEFAULT_FILTERS)
    expect(isDefaultFilters(roundTrip(DEFAULT_FILTERS))).toBe(true)
  })

  it('reads every non-default value back', () => {
    const f = filters({
      q: 'panel loader',
      brands: ['aer', 'filson'],
      families: ['olive', 'navy'],
      maxPrice: 250,
      minScore: 0.8,
      sort: 'price-desc',
    })
    expect(roundTrip(f)).toEqual(f)
  })

  it('is total on a hand-edited URL: unknown facets degrade rather than throw', () => {
    // `bellroy` is rank 7 — absent by decision (ADR-033), so this is exactly the
    // stale bookmark the forgiving parse exists for.
    const parsed = parse({
      brand: 'bellroy,peak-design,,incase',
      color: 'chartreuse,olive',
      maxPrice: 'cheap',
      minScore: 'high',
      sort: 'price-descending',
    })
    expect(parsed).toEqual(
      filters({ brands: ['peak-design'], families: ['olive'], maxPrice: null, minScore: null }),
    )
  })

  it('degrades a URL naming only absent packs to the unfiltered catalog', () => {
    const parsed = parse({ brand: 'bellroy,incase' })
    expect(parsed).toEqual(DEFAULT_FILTERS)
    expect(isDefaultFilters(parsed)).toBe(true)
  })

  it('lower-cases and trims list members, and deduplicates them', () => {
    expect(parse({ brand: ' Peak-Design , peak-design ' }).brands).toEqual(['peak-design'])
    expect(parse({ color: 'OLIVE,olive' }).families).toEqual(['olive'])
  })

  it('takes the last value of a repeated parameter rather than crashing', () => {
    expect(parse({ sort: ['rank', 'price-asc'] }).sort).toBe('price-asc')
    expect(parse({ q: [null, 'aer'] }).q).toBe('aer')
  })

  it('survives null and array-shaped query values', () => {
    expect(() => parse({ q: null, brand: [], color: [null], maxPrice: null })).not.toThrow()
    expect(parse({ q: null, brand: [], color: [null] })).toEqual(DEFAULT_FILTERS)
  })

  describe('maxPrice', () => {
    it('normalizes a ceiling at or above the catalog maximum to null — not a filter at all', () => {
      expect(parse({ maxPrice: String(DEAREST_USD) }).maxPrice).toBeNull()
      expect(parse({ maxPrice: '9999' }).maxPrice).toBeNull()
      expect(parse({ maxPrice: String(priceBounds(catalogBackpacks).max) }).maxPrice).toBeNull()
    })

    it('clamps a ceiling below the catalog floor to a value that still matches the cheapest pack', () => {
      const parsed = parse({ maxPrice: '10' })
      expect(parsed.maxPrice).not.toBeNull()
      expect(slugs(filterBackpacks(catalogBackpacks, parsed))).toContain('osprey-daylite-plus-20l')
    })

    it('never accepts a ceiling that re-encodes to a different filter', () => {
      // `?maxPrice=524.6` rounds to 525, which IS the catalog ceiling and would
      // be dropped on the next parse: the same URL means two different things
      // depending on how many times it has been through the codec.
      for (const raw of ['10', '150.4', '250', '524.6']) {
        const once = parse({ maxPrice: raw })
        expect(parse(catalogQueryParams(once))).toEqual(once)
      }
    })
  })

  describe('minScore', () => {
    it('reads a threshold back unchanged', () => {
      for (const threshold of SCORE_THRESHOLDS) {
        expect(parse({ minScore: String(threshold) }).minScore).toBe(threshold)
        expect(roundTrip(filters({ minScore: threshold })).minScore).toBe(threshold)
      }
    })

    it('rejects a non-positive or unparseable floor', () => {
      for (const raw of ['0', '-1', 'high', '']) {
        expect(parse({ minScore: raw }).minScore).toBeNull()
      }
    })

    /**
     * The rating radios test `filters.minScore === threshold` against
     * `SCORE_THRESHOLDS`, so any value the parser accepts and does not offer is
     * a filter that is actively removing packs with no control showing it as
     * set — and no control that can clear it.
     */
    it('only accepts values the rating radio group can render as selected', () => {
      for (const raw of ['0.756', '0.83', '0.9999', '1', '0.5', '0.71']) {
        expect([...SCORE_THRESHOLDS, null]).toContain(parse({ minScore: raw }).minScore)
      }
    })

    it('is stable under parse -> encode -> parse', () => {
      for (const raw of ['0.7', '0.75', '0.756', '0.83', '0.9999', '1']) {
        const once = parse({ minScore: raw })
        expect(parse(catalogQueryParams(once))).toEqual(once)
      }
    })
  })

  describe('q', () => {
    it('reads a search term back unchanged', () => {
      expect(parse({ q: 'panel loader' }).q).toBe('panel loader')
    })

    it('treats a whitespace-only term as no search at all', () => {
      expect(parse({ q: '   ' })).toEqual(DEFAULT_FILTERS)
      expect(roundTrip(filters({ q: '   ' })).q).toBe('')
    })

    /**
     * The codec must be lossless for a term that is not whitespace-only. The
     * toolbar commits its input's raw value and re-syncs the input from the
     * committed value when the two differ, so a codec that mutates its payload
     * rewrites the box under the user's cursor: typing "peak " and then "peak
     * design" loses the space at the moment the debounce fires. Trimming is a
     * rule about what a *search* means and belongs at the point of use
     * (`matchesSearch`, `isDefaultFilters`), not in the URL codec.
     */
    it.each(['peak ', ' peak', 'peak design ', 'travel  pack'])(
      'round trips %j without eating the whitespace the user typed',
      (q) => {
        expect(roundTrip(filters({ q })).q).toBe(q)
      },
    )
  })

  it('is idempotent over a hand-written URL', () => {
    const query = {
      q: 'aer',
      brand: 'aer,bellroy',
      color: 'olive,chartreuse',
      maxPrice: '250',
      minScore: '0.8',
      sort: 'price-asc',
    }
    const once = parse(query)
    expect(parse(catalogQueryParams(once))).toEqual(once)
  })

  it('ignores parameters it does not own', () => {
    expect(parse({ utm_source: 'newsletter', page: '2' })).toEqual(DEFAULT_FILTERS)
  })
})

/* -------------------------------------------------------------------------- */
/* Small pure helpers                                                         */
/* -------------------------------------------------------------------------- */

describe('isDefaultFilters', () => {
  it('is true for the defaults and for a whitespace-only search', () => {
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true)
    expect(isDefaultFilters(filters({ q: '  ' }))).toBe(true)
  })

  it.each([
    ['q', filters({ q: 'aer' })],
    ['brands', filters({ brands: ['aer'] })],
    ['families', filters({ families: ['olive'] })],
    ['maxPrice', filters({ maxPrice: 200 })],
    ['minScore', filters({ minScore: 0.8 })],
    ['sort', filters({ sort: 'price-asc' })],
  ])('is false when %s is set', (_label, f) => {
    expect(isDefaultFilters(f)).toBe(false)
  })
})

describe('activeFilterCount', () => {
  it('counts each selected facet member and excludes sort', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0)
    expect(activeFilterCount(filters({ sort: 'price-asc' }))).toBe(0)
    expect(activeFilterCount(filters({ q: '  ' }))).toBe(0)
    expect(
      activeFilterCount(
        filters({ q: 'aer', brands: ['aer', 'filson'], families: ['olive'], maxPrice: 200, minScore: 0.8 }),
      ),
    ).toBe(6)
  })
})

describe('toggleFacet', () => {
  it('adds at the end and removes in place, preserving selection order', () => {
    expect(toggleFacet<string>([], 'aer')).toEqual(['aer'])
    expect(toggleFacet(['aer', 'filson'], 'osprey')).toEqual(['aer', 'filson', 'osprey'])
    expect(toggleFacet(['aer', 'filson', 'osprey'], 'filson')).toEqual(['aer', 'osprey'])
  })

  it('does not mutate the input', () => {
    const selected = ['aer']
    toggleFacet(selected, 'filson')
    expect(selected).toEqual(['aer'])
  })

  it('returns to the same URL after an untick and retick', () => {
    const start: string[] = ['aer', 'filson']
    expect(toggleFacet(toggleFacet(start, 'filson'), 'filson')).toEqual(['aer', 'filson'])
  })
})

describe('SORT_OPTIONS', () => {
  it('offers every sort key exactly once, with the default among them', () => {
    const values = SORT_OPTIONS.map((option) => option.value)
    expect(new Set(values).size).toBe(values.length)
    expect(values).toContain(DEFAULT_SORT)
    for (const value of values) {
      expect(slugs(sortBackpacks(catalogBackpacks, value))).toHaveLength(catalogBackpacks.length)
    }
  })
})
