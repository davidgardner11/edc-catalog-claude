<script setup lang="ts">
/**
 * The card shell: 5:7 portrait, split into three bands (ADR-021).
 *
 *   65fr  CardCarousel   unobstructed image carousel
 *   15fr  CardLabel      brand over model name
 *   20fr  meta row       colorway grid | price | score
 *
 * `fr`, never `h-[65%]`. Fractional rows keep the split exact and immune to
 * content pushing it around; percentage heights reintroduce exactly the
 * shifting this rule exists to prevent.
 */
import type { Backpack } from '~/types/backpack'

const props = defineProps<{
  backpack: Backpack
  /**
   * Detail-route path, forwarded to CardLabel. Unset in Phase 3 — `/pack/[slug]`
   * does not exist yet (see CardLabel).
   */
  to?: string
}>()

/** Used for control names, so "Next image" is unambiguous in a 20-card grid. */
const fullName = computed(() => `${props.backpack.brand} ${props.backpack.name}`)
</script>

<template>
  <!--
    Every band is `min-h-0 overflow-hidden`. Without it an `fr` track keeps its
    automatic min-content floor, so a tall child could still stretch its band
    and break 65/15/20 — the `fr` unit alone is not sufficient.
  -->
  <article
    class="grid aspect-[5/7] w-full min-w-[260px] max-w-[320px] grid-rows-[65fr_15fr_20fr] overflow-hidden rounded-xl border border-card-border bg-card-surface shadow-sm"
    :aria-label="fullName"
  >
    <CardCarousel class="min-h-0" :images="backpack.images" :label="fullName" />

    <CardLabel
      class="min-h-0 border-t border-card-border"
      :brand="backpack.brand"
      :name="backpack.name"
      :to="to"
    />

    <!--
      grid-cols-[auto_1fr_1fr]: column 1 sizes to the fixed 4-wide swatch grid,
      leaving price and score equal shares of the remainder.
    -->
    <div class="grid min-h-0 grid-cols-[auto_1fr_1fr] items-center gap-2 overflow-hidden border-t border-card-border px-3">
      <ColorwayGrid :colorways="backpack.colorways" :label="fullName" />
      <PriceBlock :amount-usd="backpack.price.amountUsd" :retailer="backpack.price.retailer" />
      <ScoreBlock
        :score="backpack.review.score"
        :scale="backpack.review.scale"
        :source="backpack.review.source"
      />
    </div>
  </article>
</template>
