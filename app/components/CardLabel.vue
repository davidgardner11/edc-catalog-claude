<script setup lang="ts">
/**
 * Band 2 of BackpackCard (15fr) — brand over model name, in normal flow.
 *
 * This is deliberately NOT an overlay on the photo (ADR-021). Because it sits
 * in its own grid row, nothing that changes when the carousel advances can
 * reach it: "the label must not move or re-render as images cycle" is
 * structural here rather than something the CSS has to defend.
 *
 * The name `truncate`s. A wrapping name would grow band 2 and break the
 * 65/15/20 split, which is the one thing the card geometry cannot survive.
 */
defineProps<{
  brand: string
  name: string
  /**
   * Detail-route path. Optional and unset in Phase 3: `/pack/[slug]` does not
   * exist yet, and emitting links to it would have `nitro.prerender.crawlLinks`
   * try to prerender a 404. Phase 6 passes `/pack/${slug}` and the name becomes
   * the card's navigation affordance.
   */
  to?: string
}>()
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-col justify-center gap-0.5 overflow-hidden px-3">
    <p class="truncate text-[10px] uppercase tracking-wider text-card-muted">
      {{ brand }}
    </p>
    <!-- h3: the card is an <article>, so its title is a heading, not a <p>. -->
    <h3 class="truncate text-xs font-bold sm:text-sm">
      <NuxtLink v-if="to" :to="to" class="hover:underline focus-visible:underline">{{ name }}</NuxtLink>
      <template v-else>{{ name }}</template>
    </h3>
  </div>
</template>
