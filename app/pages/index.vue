<script setup lang="ts">
/**
 * The catalog grid: toolbar plus a responsive grid of cards.
 *
 * Phase 6 swapped `~/data/fixtures` for the real catalog. Nothing about the
 * card changed — it takes a `Backpack` either way — and the fixtures stay in
 * the tree as the unit tests' harness (ADR-009 governs catalog content, not
 * fixtures).
 *
 * The page and `CatalogToolbar` each call `useCatalogFilters()` rather than
 * passing state between them: the URL is the state (ADR-004, ADR-034).
 */
import { useCatalogFilters } from '~/composables/useCatalogFilters'

useHead({ title: 'EDC Catalog' })

const { results, total, isFiltered, reset } = useCatalogFilters()
</script>

<template>
  <main class="min-h-dvh bg-neutral-50 px-4 py-10 text-neutral-900">
    <header class="mx-auto mb-6 max-w-5xl">
      <h1 class="text-lg font-bold tracking-tight">EDC Catalog</h1>
      <p class="text-sm text-card-muted">
        {{ total }} everyday-carry backpacks, ranked by critical acclaim. Prices and review scores
        are point-in-time captures, not live.
      </p>
    </header>

    <CatalogToolbar />

    <!--
      auto-fill with minmax(260px, 320px) matches the card's own min/max width,
      so tracks never stretch a card past 320px or squeeze it below 260px.
    -->
    <ul
      v-if="results.length > 0"
      class="mx-auto grid max-w-5xl list-none grid-cols-[repeat(auto-fill,minmax(260px,320px))] justify-center gap-6 p-0"
    >
      <li v-for="pack in results" :key="pack.slug" class="flex justify-center">
        <!-- `to` is what turns the model name into the detail link. It also
             feeds `nitro.prerender.crawlLinks`, which is how every /pack/[slug]
             page gets generated (ADR-034). -->
        <BackpackCard :backpack="pack" :to="`/pack/${pack.slug}`" />
      </li>
    </ul>

    <p v-else class="mx-auto max-w-5xl rounded-lg border border-dashed border-card-border p-8 text-center text-sm text-card-muted">
      No packs match these filters.
      <button
        v-if="isFiltered"
        type="button"
        class="cursor-pointer font-medium text-neutral-900 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        @click="reset"
      >
        Clear all filters
      </button>
    </p>
  </main>
</template>
