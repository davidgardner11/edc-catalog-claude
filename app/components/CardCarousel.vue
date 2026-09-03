<script setup lang="ts">
/**
 * Band 1 of BackpackCard (65fr) — the image carousel.
 *
 * Two full-height <button> halves fill the image region, so a click anywhere on
 * the photo cycles (ADR-021). Nothing else overlays the photo: the brand/model
 * label lives in band 2, a different grid row, and the dot strip sits in its
 * own row *below* the image rather than on top of it.
 *
 * Wrapping is plain modulo (ADR-016) — no control is ever disabled, including
 * on the single-image packs.
 */
import type { CarouselImage } from '~/types/backpack'
import { neighborIndices, nextIndex, prevIndex } from '~/utils/cycle'
import { CARD_IMAGE_SIZES, buildSrcSet, fallbackSrc } from '~/utils/image'

const props = defineProps<{
  /** 1-5 images, ordered; `[0]` is primary. */
  images: CarouselImage[]
  /** "Aer Travel Pack 3" — disambiguates control names in a 20-card grid. */
  label: string
}>()

const index = ref(0)

/**
 * Set on the first prev/next click. Hidden images are `display: none`, so
 * `loading="lazy"` never resolves for them (no box, so they never intersect).
 * Flipping the attribute to `eager` once the user has shown intent starts those
 * fetches, which is what removes the flash on the *second* swap onward. The
 * first swap can still flash; preloading eagerly on mount would cost 20 cards x
 * up to 5 images on a page nobody may interact with.
 */
const primed = ref(false)

const preloaded = computed(() => new Set(neighborIndices(index.value, props.images.length)))

function shouldLoadEagerly(i: number): boolean {
  return i === 0 || (primed.value && preloaded.value.has(i))
}

function show(next: number) {
  primed.value = true
  index.value = next
}

function goPrev() {
  show(prevIndex(index.value, props.images.length))
}

function goNext() {
  show(nextIndex(index.value, props.images.length))
}
</script>

<template>
  <!--
    Keydown is bound on the container, not on a tabindex'd wrapper: the two
    zone buttons are already focusable, and the event bubbles up from whichever
    one has focus. That gives arrow-key support without adding a tab stop.
  -->
  <div
    class="grid min-h-0 grid-rows-[1fr_auto] overflow-hidden bg-neutral-100"
    role="group"
    :aria-label="`${label} images`"
    @keydown.left.prevent="goPrev"
    @keydown.right.prevent="goNext"
  >
    <div class="relative min-h-0">
      <!--
        All images stay mounted and are toggled with v-show rather than swapping
        one <img src>: changing `srcset` on a live <picture>/<source> is not
        reliably re-evaluated across browsers, and a keyed remount decodes from
        scratch on every click.
      -->
      <picture v-for="(image, i) in images" v-show="i === index" :key="image.base">
        <source type="image/avif" :srcset="buildSrcSet(image, 'avif')" :sizes="CARD_IMAGE_SIZES">
        <source type="image/webp" :srcset="buildSrcSet(image, 'webp')" :sizes="CARD_IMAGE_SIZES">
        <img
          :src="fallbackSrc(image)"
          :alt="image.alt"
          :width="image.width"
          :height="image.height"
          :loading="shouldLoadEagerly(i) ? 'eager' : 'lazy'"
          :fetchpriority="i === 0 ? 'high' : 'auto'"
          decoding="async"
          class="absolute inset-0 size-full object-contain"
        >
      </picture>

      <!--
        Left/right halves. Rendered after the images so they stack above them
        without a z-index, and they are the only interactive thing in the band.
      -->
      <button
        type="button"
        class="absolute inset-y-0 left-0 w-1/2 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-900"
        :aria-label="`Previous image of ${label}`"
        @click="goPrev"
      />
      <button
        type="button"
        class="absolute inset-y-0 right-0 w-1/2 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-900"
        :aria-label="`Next image of ${label}`"
        @click="goNext"
      />
    </div>

    <!--
      The dot row is always rendered, even for single-image packs, so the image
      region is the same height on every card. Dots are indicators, not
      controls — the click zones above are how you navigate.
    -->
    <div class="flex h-4 items-center justify-center gap-1" aria-hidden="true">
      <span
        v-for="(image, i) in images.length > 1 ? images : []"
        :key="image.base"
        class="size-1.5 rounded-full transition-colors"
        :class="i === index ? 'bg-neutral-800' : 'bg-neutral-300'"
      />
    </div>

    <p class="sr-only" aria-live="polite">
      <template v-if="images.length > 1">Image {{ index + 1 }} of {{ images.length }}</template>
    </p>
  </div>
</template>
