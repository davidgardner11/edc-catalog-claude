/**
 * The catalog data contract. Everything — ingest output (`app/data/catalog.json`),
 * fixtures, components, composables — is written against these types.
 *
 * Source of truth: the "Data model" section of
 * `implementation-plan.md`. Change both together.
 */

/**
 * Closed set of filterable colour families. A colorway's marketing name is
 * free-form ("Desert Palm", "Peppercorn"), so ingest maps each one onto a
 * family; the catalog toolbar's colour filter (Phase 6) faceted on these values,
 * never on `Colorway.name`.
 *
 * Deliberately small and closed: a facet list that grows with the data is not a
 * filter. Lowercase kebab-case so values are usable directly in URL query params
 * (the filter state is URL-backed).
 *
 * `navy` is kept distinct from `blue` because near-black navy and saturated blue
 * are visually different choices to a shopper; `multi` covers camo, colour-block,
 * and print colorways that no single family describes.
 */
export type ColorFamily =
  | 'black'
  | 'grey'
  | 'white'
  | 'navy'
  | 'blue'
  | 'green'
  | 'olive'
  | 'tan'
  | 'brown'
  | 'red'
  | 'orange'
  | 'purple'
  | 'multi'

export type Colorway = { name: string; hex: string; family: ColorFamily }

export type CarouselImage = {
  base: string              // "/images/aer-travel-pack-3/2" — width + extension appended
  widths: number[]          // [640, 1280]; srcset is `${base}-${w}.avif ${w}w`
  width: number             // intrinsic of the LARGEST variant, for aspect ratio / CLS
  height: number
  alt: string
}

/**
 * `review.scale` is stored per pack because sources disagree (REI 5.0,
 * Carryology 10.0). Display uses the raw `score`/`scale` pair; **sorting and
 * filtering must use `score / scale`** normalized to 0-1. Conflating those is
 * the easiest bug to introduce here.
 */
export type Backpack = {
  rank: number              // 1..20
  slug: string
  name: string
  brand: string
  images: CarouselImage[]         // 1..5, ordered; [0] is primary
  colorways: Colorway[]           // 0..N; grid renders 8 cells, pages above 8
  price: { amountUsd: number; retailer: string; url: string; capturedAt: string }
  review: { score: number; scale: number; source: string; url: string; capturedAt: string }
  specs?: { capacityLiters?: number; weightGrams?: number; dimensions?: string; material?: string }
}
