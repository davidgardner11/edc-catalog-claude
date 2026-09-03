<script setup lang="ts">
/**
 * Band 3, column 2 — price over retailer (ADR-021).
 *
 * Takes primitives rather than `Backpack['price']` so the detail route and any
 * future compact card can reuse it without constructing a partial Backpack.
 */
import { formatPrice } from '~/utils/format'

defineProps<{
  amountUsd: number
  /** ADR-017: the retailer the lowest compared price came from. */
  retailer: string
}>()
</script>

<template>
  <div class="flex min-w-0 flex-col justify-center">
    <p class="truncate text-sm font-bold tabular-nums sm:text-base">
      <span class="sr-only">Price </span>{{ formatPrice(amountUsd) }}
    </p>
    <p class="truncate text-[10px] text-card-muted">
      <span class="sr-only">at </span>{{ retailer }}
    </p>
  </div>
</template>
