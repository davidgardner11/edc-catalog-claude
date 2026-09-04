<script setup lang="ts">
/**
 * Every product photo for one pack, on the `/pack/[slug]` detail route.
 *
 * Deliberately **not** a carousel. `CardCarousel` exists because a card has room
 * for exactly one photo; the detail page has room for all 1-5, so showing them
 * at once is strictly more useful and carries no state, no wrap arithmetic and
 * no controls to make accessible. The `Pack*` prefix mirrors `Card*`: it means
 * "only makes sense on the detail route".
 *
 * `public/images/` is gitignored (ADR-012), so on a fresh clone these 404 until
 * `pnpm ingest` has run. Intrinsic `width`/`height` are still emitted, so the
 * layout does not shift either way.
 */
import type { CarouselImage } from '~/types/backpack'
import { PACK_PRIMARY_IMAGE_SIZES, PACK_THUMB_IMAGE_SIZES, buildSrcSet, fallbackSrc } from '~/utils/image'

const props = defineProps<{
  /** 1-5 images, ordered; `[0]` is primary. */
  images: CarouselImage[]
  /** "Aer Travel Pack 3" — names the figure group. */
  label: string
}>()

const primary = computed(() => props.images[0])
const rest = computed(() => props.images.slice(1))
</script>

<template>
  <div :aria-label="`${label} photographs`" role="group">
    <picture v-if="primary">
      <source type="image/avif" :srcset="buildSrcSet(primary, 'avif')" :sizes="PACK_PRIMARY_IMAGE_SIZES">
      <source type="image/webp" :srcset="buildSrcSet(primary, 'webp')" :sizes="PACK_PRIMARY_IMAGE_SIZES">
      <img
        :src="fallbackSrc(primary)"
        :alt="primary.alt"
        :width="primary.width"
        :height="primary.height"
        loading="eager"
        fetchpriority="high"
        decoding="async"
        class="aspect-square w-full rounded-xl border border-card-border bg-neutral-100 object-contain"
      >
    </picture>

    <ul v-if="rest.length > 0" class="mt-3 grid list-none grid-cols-2 gap-3 p-0">
      <li v-for="image in rest" :key="image.base">
        <picture>
          <source type="image/avif" :srcset="buildSrcSet(image, 'avif')" :sizes="PACK_THUMB_IMAGE_SIZES">
          <source type="image/webp" :srcset="buildSrcSet(image, 'webp')" :sizes="PACK_THUMB_IMAGE_SIZES">
          <img
            :src="fallbackSrc(image)"
            :alt="image.alt"
            :width="image.width"
            :height="image.height"
            loading="lazy"
            decoding="async"
            class="aspect-square w-full rounded-lg border border-card-border bg-neutral-100 object-contain"
          >
        </picture>
      </li>
    </ul>
  </div>
</template>
