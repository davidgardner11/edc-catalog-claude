import type { CarouselImage } from '~/types/backpack'

/**
 * `CarouselImage.base` omits width and extension ("/images/{slug}/2"); ingest
 * emits `{base}-{w}.{avif,webp}` for each width (ADR-005). These helpers are
 * the only place that filename shape is spelled out on the frontend — if the
 * ingest naming changes, it changes here and nowhere else.
 */
export type ImageFormat = 'avif' | 'webp'

/** `"/images/x/0-640.avif 640w, /images/x/0-1280.avif 1280w"` */
export function buildSrcSet(image: CarouselImage, format: ImageFormat): string {
  return [...image.widths]
    .sort((a, b) => a - b)
    .map((w) => `${image.base}-${w}.${format} ${w}w`)
    .join(', ')
}

/**
 * `src` for the `<img>` inside `<picture>`: the widest **WebP**, since WebP is
 * the universally supported of the two formats and this attribute is the
 * fallback for browsers that match no `<source>`.
 *
 * Falls back to `image.width` if `widths` is empty. The zod schema pins
 * `widths` to `[640, 1280]`, so that path should be unreachable in catalog
 * data; it exists so a malformed fixture renders a broken image rather than
 * `...-Infinity.webp`.
 */
export function fallbackSrc(image: CarouselImage, format: ImageFormat = 'webp'): string {
  const widest = image.widths.length > 0 ? Math.max(...image.widths) : image.width
  return `${image.base}-${widest}.${format}`
}

/**
 * `sizes` for a card carousel image. Card width is pinned to 260-320px
 * (ADR-021), so the slot never exceeds 320px at any breakpoint and a fixed
 * value is honest — no `100vw` guess. A 2x screen therefore picks the 640w
 * variant, which is exactly why 640 is the smaller of the two widths.
 */
export const CARD_IMAGE_SIZES = '320px'
