<script setup lang="ts">
/**
 * The pack detail route — a real prerendered page, not a modal (ADR-013).
 *
 * **How it gets generated.** `nuxt generate` emits pure static output and there
 * is no server at runtime, so every one of these pages must exist as a file at
 * build time. It does, without a route manifest: the index page renders a
 * `<NuxtLink>` to `/pack/${slug}` for every pack in the catalog, and
 * `nitro.prerender.crawlLinks` (already set in `nuxt.config.ts`) follows them.
 * The unfiltered catalog is what prerenders — filters are a client-side,
 * post-hydration concern — so the crawl always sees all of them (ADR-034).
 *
 * `useRoute().params` is a static-route lookup here, not runtime data fetching:
 * the catalog is a bundled build-time import (ADR-004).
 */
import { catalogBackpacks, findBackpack } from '~/data/catalog'
import { formatCapacity, formatCapturedDate, formatWeight } from '~/utils/format'
import { colorFamilyLabel } from '~/utils/color'

const route = useRoute()

const slug = computed(() => String(route.params.slug ?? ''))
const pack = computed(() => findBackpack(slug.value))

// Only reachable by hand-typing a URL: crawlLinks generates exactly the slugs
// that exist. `fatal` renders the error page instead of a half-built detail view.
if (!pack.value) {
  throw createError({ statusCode: 404, statusMessage: 'Pack not found', fatal: true })
}

const fullName = computed(() => `${pack.value?.brand} ${pack.value?.name}`)

/** Neighbours in acclaim order, for prev/next links at the foot of the page. */
const ordered = computed(() => [...catalogBackpacks].sort((a, b) => a.rank - b.rank))
const position = computed(() => ordered.value.findIndex((entry) => entry.slug === slug.value))
const previousPack = computed(() => ordered.value[position.value - 1])
const nextPack = computed(() => ordered.value[position.value + 1])

useHead(() => ({
  title: pack.value ? `${fullName.value} — EDC Catalog` : 'Pack not found',
  meta: [
    {
      name: 'description',
      content: pack.value
        ? `${fullName.value}: rank ${pack.value.rank} in the EDC backpack catalog.`
        : '',
    },
  ],
}))

const specRows = computed(() => {
  const specs = pack.value?.specs
  if (!specs) return []
  return [
    { term: 'Capacity', value: specs.capacityLiters === undefined ? '' : formatCapacity(specs.capacityLiters) },
    { term: 'Weight', value: specs.weightGrams === undefined ? '' : formatWeight(specs.weightGrams) },
    { term: 'Dimensions', value: specs.dimensions ?? '' },
    { term: 'Material', value: specs.material ?? '' },
  ].filter((row) => row.value !== '')
})
</script>

<template>
  <main v-if="pack" class="min-h-dvh bg-neutral-50 px-4 py-10 text-neutral-900">
    <div class="mx-auto max-w-5xl">
      <nav aria-label="Breadcrumb" class="mb-6 text-sm">
        <NuxtLink
          to="/"
          class="text-card-muted underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          &larr; All packs
        </NuxtLink>
      </nav>

      <div class="grid gap-8 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <PackGallery :images="pack.images" :label="fullName" />

        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-wider text-card-muted">
            {{ pack.brand }}
            <!-- Ranks are sparse (ADR-033): "rank 17" is not "17th". -->
            <span class="ml-2 rounded-full bg-neutral-900 px-2 py-0.5 text-white">
              Rank {{ pack.rank }}
            </span>
          </p>
          <h1 class="mt-2 text-2xl font-bold tracking-tight">{{ pack.name }}</h1>

          <!--
            PriceBlock and ScoreBlock are reused verbatim from the card. They
            take primitives rather than a `Backpack` precisely so this page could
            use them without constructing a partial pack — see
            docs/component-conventions.md.
          -->
          <div class="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-card-border bg-card-surface p-4">
            <div>
              <PriceBlock :amount-usd="pack.price.amountUsd" :retailer="pack.price.retailer" />
              <p class="mt-2 text-xs text-card-muted">
                <!-- ADR-009: never imply a live price. -->
                Captured {{ formatCapturedDate(pack.price.capturedAt) }}
              </p>
              <a
                :href="pack.price.url"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-1 inline-block text-xs underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                View at {{ pack.price.retailer }}
                <span class="sr-only">(opens in a new tab)</span>
              </a>
            </div>

            <div>
              <ScoreBlock
                :score="pack.review.score"
                :scale="pack.review.scale"
                :source="pack.review.source"
              />
              <p class="mt-2 text-xs text-card-muted">
                Captured {{ formatCapturedDate(pack.review.capturedAt) }}
              </p>
              <a
                :href="pack.review.url"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-1 inline-block text-xs underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                Read the {{ pack.review.source }} review
                <span class="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          </div>

          <section v-if="pack.colorways.length > 0" class="mt-8">
            <h2 class="text-xs font-bold uppercase tracking-wider text-card-muted">
              {{ pack.colorways.length }} colorways
            </h2>
            <!--
              The full list, not ColorwayGrid: the 8-cell grid with its pager
              exists because a CARD has room for exactly 8 (ADR-015). This page
              has room for all of them, so paging here would hide data for no
              reason. Swatch hexes are sampled from brand photography and are
              best-effort, not hex-identical (ADR-029).
            -->
            <ul class="mt-3 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
              <li v-for="colorway in pack.colorways" :key="`${colorway.name}-${colorway.hex}`" class="flex min-w-0 items-center gap-2">
                <span
                  class="size-4 shrink-0 rounded-full ring-1 ring-inset ring-black/15"
                  :style="{ backgroundColor: colorway.hex }"
                  aria-hidden="true"
                />
                <span class="min-w-0 truncate text-sm" :title="colorway.name">
                  {{ colorway.name }}
                  <span class="sr-only">({{ colorFamilyLabel(colorway.family) }})</span>
                </span>
              </li>
            </ul>
          </section>

          <section v-if="specRows.length > 0" class="mt-8">
            <h2 class="text-xs font-bold uppercase tracking-wider text-card-muted">Specifications</h2>
            <dl class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <template v-for="row in specRows" :key="row.term">
                <dt class="font-medium text-card-muted">{{ row.term }}</dt>
                <dd class="min-w-0">{{ row.value }}</dd>
              </template>
            </dl>
          </section>
        </div>
      </div>

      <nav aria-label="Adjacent packs by rank" class="mt-12 flex justify-between gap-4 border-t border-card-border pt-6 text-sm">
        <NuxtLink
          v-if="previousPack"
          :to="`/pack/${previousPack.slug}`"
          class="min-w-0 truncate underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          &larr; {{ previousPack.brand }} {{ previousPack.name }}
        </NuxtLink>
        <span v-else />

        <NuxtLink
          v-if="nextPack"
          :to="`/pack/${nextPack.slug}`"
          class="min-w-0 truncate text-right underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          {{ nextPack.brand }} {{ nextPack.name }} &rarr;
        </NuxtLink>
        <span v-else />
      </nav>
    </div>
  </main>
</template>
