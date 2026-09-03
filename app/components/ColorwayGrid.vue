<script setup lang="ts">
/**
 * Band 3, column 1 — the rigid 4x2 colorway grid (ADR-015).
 *
 * Exactly 8 cells are rendered on every card, whatever the colorway count:
 * colorways, then ghost padding, then (above 8) the `>` pager in cell 8. All
 * of the arithmetic lives in `~/utils/cycle` so the boundary cases (0, 8, 9,
 * partial final page) are unit-testable without mounting anything.
 */
import type { Colorway } from '~/types/backpack'
import { colorFamilyLabel } from '~/utils/color'
import { colorwayPage, nextIndex } from '~/utils/cycle'

const props = defineProps<{
  colorways: Colorway[]
  /** Pack name, so control names are unique across a 20-card grid. */
  label: string
}>()

const page = ref(0)

const view = computed(() => colorwayPage(props.colorways, page.value))

/** Wrapping, like the carousel: `>` on the last page returns to the first. */
const nextPage = computed(() => nextIndex(view.value.page, view.value.pageCount))

function goNextPage(event: MouseEvent) {
  // ADR-015: the pager is the card's third click target. Band 3 sits outside
  // the carousel's click zones so it can no longer advance the image, but the
  // stop is kept for the Phase 6 card-body navigation handler above it.
  event.stopPropagation()
  page.value = nextPage.value
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1">
    <div
      class="grid w-fit grid-cols-4 grid-rows-2 gap-1"
      role="group"
      :aria-label="`${colorways.length} colorways`"
    >
      <span
        v-for="colorway in view.items"
        :key="`${colorway.name}-${colorway.hex}`"
        class="size-3.5 rounded-full ring-1 ring-inset ring-black/15"
        :style="{ backgroundColor: colorway.hex }"
        :title="colorway.name"
      >
        <!-- Ring rather than a border: it renders inside the swatch, so a
             white colorway stays visible without changing the cell's size. -->
        <span class="sr-only">{{ colorway.name }} ({{ colorFamilyLabel(colorway.family) }})</span>
      </span>

      <span
        v-for="ghost in view.ghostCells"
        :key="`ghost-${ghost}`"
        class="size-3.5 rounded-full border border-dashed border-swatch-ghost"
        aria-hidden="true"
      />

      <button
        v-if="view.hasPager"
        type="button"
        class="grid size-3.5 cursor-pointer place-items-center rounded-full border border-card-border text-[9px] leading-none text-card-muted hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
        :aria-label="`Show colorway page ${nextPage + 1} of ${view.pageCount} for ${label}`"
        @click="goNextPage"
      >
        <span aria-hidden="true">&rsaquo;</span>
      </button>
    </div>

    <p v-if="view.pageCount > 1" class="sr-only" aria-live="polite">
      Colorway page {{ view.page + 1 }} of {{ view.pageCount }}
    </p>
  </div>
</template>
