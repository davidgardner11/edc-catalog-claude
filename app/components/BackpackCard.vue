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
      grid-cols-3: equal thirds, so each cell has room to centre its own
      content (ADR-038). Column 1 was previously `auto`, sized exactly to the
      68px swatch grid, which left nothing to centre within.

      No `items-center`: cells stretch to the full band height so their
      `border-l` dividers meet the top border and the card's bottom edge
      instead of floating as stubs (measured: 32px of a 72px band before).
      Each cell centres its own content vertically instead.

      No `gap` and no `px` here either, for a different reason — with padding
      on the container the rules land at thirds of the *padded box*, 12px
      inboard of the thirds of the card; with a gap, the whole gap falls on one
      side of each rule. Cell padding is capped at `px-2`: at the 260px card
      the tracks are 86px and the swatch grid's min-content is 68px, so more
      than 9px a side makes it overflow cell 1 and cross the divider, breaking
      ADR-015's 8 visible cells. Invisible at 320px. See ADR-038.
    -->
    <div class="grid min-h-0 grid-cols-3 overflow-hidden border-t border-card-border">
      <ColorwayGrid :colorways="backpack.colorways" :label="fullName" />
      <!--
        `text-center`, not `justify-items-center` on the container: that would
        shrink-wrap each cell to its content, and `truncate` needs a box
        narrower than its text to ellipsize. Passed here rather than set inside
        PriceBlock/ScoreBlock because both are also used on the detail route,
        which does not inherit the card's constraints (component-conventions).
      -->
      <PriceBlock
        class="border-l border-card-border px-1 text-center"
        :amount-usd="backpack.price.amountUsd"
        :retailer="backpack.price.retailer"
      />
      <ScoreBlock
        class="border-l border-card-border px-1 text-center"
        :score="backpack.review.score"
        :scale="backpack.review.scale"
        :source="backpack.review.source"
      />
    </div>
  </article>
</template>
