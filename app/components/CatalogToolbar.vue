<script setup lang="ts">
/**
 * Search, filter and sort for the catalog grid.
 *
 * **Takes no props and emits nothing.** It calls `useCatalogFilters()` itself,
 * as the page does; both read the same URL, so they are in sync without any
 * data being passed between them (ADR-004, ADR-034). Adding props here would
 * create a second, weaker source of truth alongside the query string.
 *
 * The four filter groups live inside one native `<details>` rather than four
 * separate popovers. One disclosure means no click-outside handling, no focus
 * trap, no z-index stacking and no two panels overlapping each other — and it
 * works before hydration. The cost is that opening it pushes the grid down,
 * which is predictable and reversible.
 *
 * Active filters are also mirrored as removable chips outside the disclosure,
 * so a filtered view is legible with the panel shut.
 */
import type { ColorFamily } from '~/types/backpack'
import { useCatalogFilters } from '~/composables/useCatalogFilters'
import { colorFamilyLabel } from '~/utils/color'
import { formatPrice } from '~/utils/format'
import { SCORE_THRESHOLDS, SORT_OPTIONS, formatScoreThreshold } from '~/utils/catalog'
import type { SortKey } from '~/utils/catalog'

const {
  filters,
  results,
  total,
  bounds,
  brands,
  colors,
  activeCount,
  isFiltered,
  setSearch,
  toggleBrand,
  toggleFamily,
  setMaxPrice,
  setMinScore,
  setSort,
  reset,
} = useCatalogFilters()

/**
 * `FacetCheckboxGroup` is generic over `string`, so its emit is a `string`. The
 * values it can emit are exactly the `option.value`s it was given, and `colors`
 * carries `ColorFamily` values (ADR-022) — hence the assertion rather than a
 * runtime guard.
 */
function onToggleFamily(value: string) {
  toggleFamily(value as ColorFamily)
}

/* -- Search ---------------------------------------------------------------- */

/**
 * The input is bound to a draft, not to the URL, and commits on a 200ms idle.
 * Writing `router.replace` per keystroke would put a route resolution in the
 * middle of every character. The draft is re-synced from `filters` so Back,
 * "Clear all" and a chip removal all reach the input.
 */
const searchDraft = ref('')
watch(() => filters.value.q, (q) => {
  if (q !== searchDraft.value) searchDraft.value = q
}, { immediate: true })

let searchTimer: ReturnType<typeof setTimeout> | undefined

function scheduleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => setSearch(searchDraft.value), 200)
}

/** Enter and the native `type="search"` clear button skip the debounce. */
function flushSearch() {
  clearTimeout(searchTimer)
  setSearch(searchDraft.value)
}

onBeforeUnmount(() => clearTimeout(searchTimer))

/* -- Price ----------------------------------------------------------------- */

/**
 * Same draft pattern, for a different reason: `@input` fires continuously while
 * a range thumb is dragged. The visible value tracks the thumb; the URL is
 * written once, on `@change` (pointer release / arrow keypress).
 *
 * At the catalog ceiling the filter is cleared rather than pinned to the top
 * price — "up to the most expensive pack" is not a filter, and the URL should
 * not claim one.
 */
const priceDraft = ref(bounds.value.max)
watch([() => filters.value.maxPrice, bounds], ([maxPrice, range]) => {
  priceDraft.value = maxPrice ?? range.max
}, { immediate: true })

function commitPrice() {
  setMaxPrice(priceDraft.value >= bounds.value.max ? null : priceDraft.value)
}

/* -- Chips ----------------------------------------------------------------- */

type FilterChip = { key: string; label: string; remove: () => void }

const chips = computed<FilterChip[]>(() => {
  const out: FilterChip[] = []
  const active = filters.value

  if (active.q.trim() !== '') {
    out.push({ key: 'q', label: `Search: ${active.q}`, remove: () => setSearch('') })
  }
  for (const slug of active.brands) {
    const label = brands.value.find((facet) => facet.value === slug)?.label ?? slug
    out.push({ key: `brand:${slug}`, label, remove: () => toggleBrand(slug) })
  }
  for (const family of active.families) {
    out.push({
      key: `color:${family}`,
      label: colorFamilyLabel(family),
      remove: () => toggleFamily(family),
    })
  }
  if (active.maxPrice !== null) {
    out.push({
      key: 'maxPrice',
      label: `Up to ${formatPrice(active.maxPrice)}`,
      remove: () => setMaxPrice(null),
    })
  }
  if (active.minScore !== null) {
    out.push({
      key: 'minScore',
      label: `Rated ${formatScoreThreshold(active.minScore)}+`,
      remove: () => setMinScore(null),
    })
  }
  return out
})
</script>

<template>
  <section class="mx-auto mb-8 max-w-5xl" aria-label="Search, filter and sort the catalog">
    <div class="flex flex-wrap items-end gap-3">
      <!-- role="search" rather than a <form>: there is nothing to submit — the
           filter is live and the URL is written as you type. -->
      <div role="search" class="min-w-[16rem] flex-1">
        <label for="catalog-search" class="mb-1 block text-xs font-bold uppercase tracking-wider text-card-muted">
          Search
        </label>
        <input
          id="catalog-search"
          v-model="searchDraft"
          type="search"
          autocomplete="off"
          placeholder="Brand or model"
          class="w-full rounded-lg border border-card-border bg-card-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
          @input="scheduleSearch"
          @search="flushSearch"
          @keydown.enter.prevent="flushSearch"
        >
      </div>

      <div>
        <label for="catalog-sort" class="mb-1 block text-xs font-bold uppercase tracking-wider text-card-muted">
          Sort by
        </label>
        <select
          id="catalog-sort"
          class="rounded-lg border border-card-border bg-card-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
          :value="filters.sort"
          @change="setSort(($event.target as HTMLSelectElement).value as SortKey)"
        >
          <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <details class="group mt-3 rounded-lg border border-card-border bg-card-surface">
      <summary
        class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-900 [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" class="inline-block transition-transform group-open:rotate-90">&rsaquo;</span>
        <span>Filters</span>
        <span
          v-if="activeCount > 0"
          class="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white"
        >
          {{ activeCount }}<span class="sr-only"> active</span>
        </span>
      </summary>

      <div class="grid gap-6 border-t border-card-border p-4 md:grid-cols-2">
        <FacetCheckboxGroup
          legend="Brand"
          :options="brands"
          :selected="filters.brands"
          @toggle="toggleBrand"
        />

        <FacetCheckboxGroup
          legend="Colour"
          :options="colors"
          :selected="filters.families"
          @toggle="onToggleFamily"
        />

        <fieldset class="min-w-0">
          <legend class="mb-2 text-xs font-bold uppercase tracking-wider text-card-muted">
            Maximum price
          </legend>
          <!-- A single native range: the catalog's floor is $79.95, so a
               two-thumb range would only ever be used from the top. -->
          <input
            id="catalog-max-price"
            v-model.number="priceDraft"
            type="range"
            class="w-full accent-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            :min="bounds.min"
            :max="bounds.max"
            step="5"
            :aria-valuetext="priceDraft >= bounds.max ? 'No maximum' : `Up to ${formatPrice(priceDraft)}`"
            @change="commitPrice"
          >
          <output id="catalog-max-price-value" for="catalog-max-price" class="mt-1 block text-sm tabular-nums">
            <template v-if="priceDraft >= bounds.max">No maximum</template>
            <template v-else>Up to {{ formatPrice(priceDraft) }}</template>
          </output>
        </fieldset>

        <fieldset class="min-w-0">
          <legend class="mb-2 text-xs font-bold uppercase tracking-wider text-card-muted">
            Minimum rating
          </legend>
          <!-- Thresholds are percentages of each pack's OWN scale, because
               `review.scale` is 5.0 or 10.0 per source (ADR-010). "8.0+" would
               mean two different things across the catalog; "80%+" means one. -->
          <p class="mb-2 text-xs text-card-muted">
            Sources score on 5.0 or 10.0, so ratings compare as a share of their own scale.
          </p>
          <div class="grid grid-cols-2 gap-y-1 sm:grid-cols-3">
            <label class="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="catalog-min-score"
                class="size-4 accent-neutral-900"
                :checked="filters.minScore === null"
                @change="setMinScore(null)"
              >
              <span>Any</span>
            </label>
            <label
              v-for="threshold in SCORE_THRESHOLDS"
              :key="threshold"
              class="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="catalog-min-score"
                class="size-4 accent-neutral-900"
                :checked="filters.minScore === threshold"
                @change="setMinScore(threshold)"
              >
              <span class="tabular-nums">{{ formatScoreThreshold(threshold) }}+</span>
            </label>
          </div>
        </fieldset>
      </div>
    </details>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <!-- role="status" is an implicit polite live region: the result count is
           the only feedback a screen-reader user gets that a filter applied. -->
      <p role="status" class="text-sm text-card-muted">
        Showing {{ results.length }} of {{ total }} packs
      </p>

      <ul v-if="chips.length > 0" class="flex list-none flex-wrap gap-2 p-0">
        <li v-for="chip in chips" :key="chip.key">
          <button
            type="button"
            class="flex cursor-pointer items-center gap-1 rounded-full border border-card-border bg-card-surface py-1 pl-3 pr-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 hover:bg-neutral-100"
            @click="chip.remove"
          >
            <span class="sr-only">Remove filter: </span>
            <span>{{ chip.label }}</span>
            <span aria-hidden="true" class="text-card-muted">&times;</span>
          </button>
        </li>
      </ul>

      <button
        v-if="isFiltered"
        type="button"
        class="ml-auto cursor-pointer rounded-lg border border-card-border bg-card-surface px-3 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 hover:bg-neutral-100"
        @click="reset"
      >
        Clear all
      </button>
    </div>
  </section>
</template>
