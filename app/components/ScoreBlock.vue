<script setup lang="ts">
/**
 * Band 3, column 3 — review score over source (ADR-021), mirroring PriceBlock.
 *
 * Displays the RAW `score`/`scale` pair, because the scale differs per pack
 * (ADR-010) and "9.2" alone is ambiguous. Anything that *orders* packs must use
 * `normalizeScore` instead; nothing in this component does.
 */
import { formatScore, scoreSpokenLabel } from '~/utils/format'

defineProps<{
  score: number
  /** 5.0 (retailer) or 10.0 (enthusiast review site). */
  scale: number
  source: string
}>()
</script>

<template>
  <div class="flex min-w-0 flex-col justify-center">
    <p class="truncate text-sm font-bold tabular-nums sm:text-base">
      <!-- Visible "4.4/5.0" is hidden from assistive tech: readers announce the
           slash inconsistently ("4.4 slash 5", "4.4 fraction 5"). -->
      <span aria-hidden="true">{{ formatScore(score, scale) }}</span>
      <span class="sr-only">{{ scoreSpokenLabel(score, scale, source) }}</span>
    </p>
    <p class="truncate text-[10px] text-card-muted" aria-hidden="true">
      {{ source }}
    </p>
  </div>
</template>
