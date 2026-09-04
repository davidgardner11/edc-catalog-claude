import type { Backpack, ColorFamily } from '~/types/backpack'
import { catalogBackpacks } from '~/data/catalog'
import {
  DEFAULT_FILTERS,
  QUERY_KEYS,
  activeFilterCount,
  applyCatalogFilters,
  brandFacets,
  catalogQueryParams,
  colorFacets,
  isDefaultFilters,
  parseCatalogQuery,
  priceBounds,
  toggleFacet,
} from '~/utils/catalog'
import type { CatalogFilters, SortKey } from '~/utils/catalog'

/**
 * The catalog's search / filter / sort state, and the **only** state in this
 * app beyond a card's local carousel and pager refs (ADR-004).
 *
 * There is no store, and there must not be one. The state lives in the URL:
 * `useRoute().query` is the single source of truth, so a filtered view is
 * bookmarkable, shareable and survives a reload, none of which a store gives
 * you. Every component that needs the state calls this composable directly —
 * the page and the toolbar each do — and they agree because they are both
 * reading the same URL, not because anything was passed between them. That is
 * why the toolbar takes no props and emits no events.
 *
 * All of the rules (what matches, what sorts, how a param is spelled) are in
 * `~/utils/catalog`, which is pure and unit-testable. This file is plumbing.
 *
 * ## The hydration gate
 *
 * `nuxt generate` prerenders `/` with **no query string** — there is no server
 * at runtime, so a request for `/?brand=aer` is served that same HTML file.
 * The client, though, resolves its route from the real URL and knows the query
 * on its very first render, before hydration. Filtering immediately would make
 * the first client render disagree with the prerendered markup and produce a
 * hydration mismatch.
 *
 * So the query is ignored until `onMounted`. Prerender and the first client
 * render both see `DEFAULT_FILTERS` and therefore the same DOM; the filters
 * apply one tick later. The visible cost is a brief flash of the full catalog
 * when you open a filtered link — the alternative, a mismatch, silently
 * discards the server DOM and re-renders anyway.
 */
export function useCatalogFilters(source: readonly Backpack[] = catalogBackpacks) {
  const route = useRoute()
  const router = useRouter()

  /** Brand facets and price bounds come from the FULL catalog, never the current
   *  results, so the controls do not move around as the user narrows the list.
   *  Colour facets come from the `ColorFamily` union and not from the catalog at
   *  all (ADR-022), which is why `colorFacets` takes no argument. `colors` is
   *  therefore a `computed` with no reactive dependency — deliberately, and not
   *  an oversight to unwrap: it keeps `bounds`/`brands`/`colors` a uniform ref
   *  shape for the toolbar, at the cost of caching a value that cannot change. */
  const bounds = computed(() => priceBounds(source))
  const brands = computed(() => brandFacets(source))
  const colors = computed(() => colorFacets())

  const ready = ref(false)
  onMounted(() => {
    ready.value = true
  })

  const filters = computed<CatalogFilters>(() =>
    ready.value ? parseCatalogQuery(route.query, source) : DEFAULT_FILTERS,
  )

  const results = computed(() => applyCatalogFilters(source, filters.value))
  /** Catalog size, for "showing N of M". 17, not 19 — ranks 7 and 16 are absent (ADR-033). */
  const total = computed(() => source.length)
  const activeCount = computed(() => activeFilterCount(filters.value))
  const isFiltered = computed(() => !isDefaultFilters(filters.value))

  /** Query params this composable does not own are carried through untouched. */
  // Return type is inferred (vue-router's `LocationQueryValue`), not annotated:
  // widening it to `unknown` makes it unassignable to `LocationQueryRaw`.
  function foreignQuery() {
    return Object.fromEntries(
      Object.entries(route.query).filter(([key]) => !(QUERY_KEYS as readonly string[]).includes(key)),
    )
  }

  /**
   * The last patch handed to `commit` while its navigation is still in flight.
   *
   * `router.replace` is **async**: `route.query` — and therefore `filters` — does
   * not update until the navigation resolves. Two commits in the same tick (the
   * debounced search firing while a checkbox is ticked, a slider `change` landing
   * with a sort change) would both read the pre-navigation query, and the second
   * would overwrite the first with a URL that never mentions it. Merging onto the
   * in-flight value instead of the route makes the second commit a patch on top
   * of the first, so neither is lost (ADR-036).
   *
   * Not unit-testable without mounting a router, which would mean adding
   * `@nuxt/test-utils` and `happy-dom`; it is E2E-observable once Playwright
   * lands (Phase 7).
   */
  let inFlight: CatalogFilters | null = null

  /**
   * The filters as they will be once any in-flight navigation lands — the base
   * every patch is computed against. The facet toggles need it as much as
   * `commit` does: `toggleFacet` reads the current selection, so two boxes
   * ticked in one tick would otherwise both toggle against the same route query
   * and the second would drop the first.
   */
  function current(): CatalogFilters {
    return inFlight ?? filters.value
  }

  /**
   * `replace`, not `push`. Every keystroke and checkbox would otherwise become
   * a history entry, and the back button's job here is to leave the catalog —
   * not to walk backwards through the letters of a search term. Navigating to a
   * detail page and back still restores the filtered URL, because the entry
   * that was replaced is the one being returned to.
   */
  function commit(patch: Partial<CatalogFilters>) {
    const merged: CatalogFilters = { ...current(), ...patch }
    inFlight = merged
    // `catalogQueryParams` returns `undefined` for anything at its default, and
    // vue-router drops undefined values — that is what keeps a clean URL clean.
    // Foreign params are read from the route, not accumulated: this composable
    // never writes them, so they cannot be stale.
    const navigation = router.replace({ query: { ...foreignQuery(), ...catalogQueryParams(merged) } })
    // Identity check, so a later commit's value is not cleared by an earlier
    // commit settling. Both arms of `then` — a navigation that is aborted or
    // redirected still ends the in-flight window, and an unhandled rejection here
    // would surface as a console error rather than anything a user could act on.
    const settle = () => {
      if (inFlight === merged) inFlight = null
    }
    void navigation.then(settle, settle)
  }

  return {
    /**
     * A `computed` with no setter, deliberately: filters are mutated through the
     * setters below so that every change goes through the URL. Not wrapped in
     * `readonly()` — that would add a `DeepReadonly` layer to every consumer's
     * types for no extra safety, since the object is rebuilt on each read.
     */
    filters,
    results,
    total,
    bounds,
    brands,
    colors,
    activeCount,
    isFiltered,
    /** False during prerender and the first client render — see "hydration gate". */
    ready: readonly(ready),

    setSearch: (q: string) => commit({ q }),
    toggleBrand: (slug: string) => commit({ brands: toggleFacet(current().brands, slug) }),
    toggleFamily: (family: ColorFamily) =>
      commit({ families: toggleFacet(current().families, family) }),
    setMaxPrice: (maxPrice: number | null) => commit({ maxPrice }),
    setMinScore: (minScore: number | null) => commit({ minScore }),
    setSort: (sort: SortKey) => commit({ sort }),
    /**
     * Clears filters AND sort; the "Clear all" affordance is all-or-nothing.
     * Routed through `commit` rather than calling `router.replace` directly so it
     * shares the in-flight accumulator above — otherwise a debounced search
     * committed a tick earlier would be re-applied by the next commit after the
     * reset had already cleared it. Every param is at its default, so
     * `catalogQueryParams` is all-`undefined` and only `foreignQuery` survives.
     */
    reset: () => commit(DEFAULT_FILTERS),
  }
}
