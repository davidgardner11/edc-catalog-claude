<script setup lang="ts">
/**
 * Phase 3: the card grid, rendered from `app/data/fixtures.ts`.
 *
 * Fixtures are the development harness, NOT catalog content (ADR-009). Phase 6
 * swaps this import for `app/data/catalog.json` and adds the toolbar; nothing
 * else on this page changes, because the card takes a `Backpack` either way.
 */
import { fixtureBackpacks } from '~/data/fixtures'

useHead({ title: 'EDC Catalog' })

/** Acclaim rank is the default order (ADR-018). Fixtures are 4, 3, 13. */
const packs = computed(() => [...fixtureBackpacks].sort((a, b) => a.rank - b.rank))
</script>

<template>
  <main class="min-h-dvh bg-neutral-50 px-4 py-10 text-neutral-900">
    <header class="mx-auto mb-8 max-w-5xl">
      <h1 class="text-lg font-bold tracking-tight">EDC Catalog</h1>
      <p class="text-sm text-card-muted">
        Ranked by critical acclaim. Showing {{ packs.length }} development fixtures — product images
        land with <code>pnpm ingest</code>.
      </p>
    </header>

    <!--
      auto-fill with minmax(260px, 320px) matches the card's own min/max width,
      so tracks never stretch a card past 320px or squeeze it below 260px.
    -->
    <ul class="mx-auto grid max-w-5xl list-none grid-cols-[repeat(auto-fill,minmax(260px,320px))] justify-center gap-6 p-0">
      <li v-for="pack in packs" :key="pack.slug" class="flex justify-center">
        <BackpackCard :backpack="pack" />
      </li>
    </ul>
  </main>
</template>
