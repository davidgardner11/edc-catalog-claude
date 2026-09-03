/**
 * The ranked list — the editorial half of the catalog.
 *
 * Ranking is pure critical acclaim (ADR-018); there is no popularity term and
 * no arithmetic behind the ordering, so every entry carries the `rationale`
 * that justifies its position and the ordering stays auditable.
 *
 * This file holds only what is *judged*. Everything that is *measured* —
 * prices, review scores, colorways, specs, image URLs — lives in
 * `data/sources/{slug}.json` next to a `capturedAt` (ADR-009). Keeping them
 * apart means re-capturing a stale price never touches the ranking, and
 * re-ranking never invalidates a capture.
 *
 * `pnpm ingest` reads this file, so it is an *input*: edit it freely. The
 * outputs (`app/data/catalog.json`, `public/images/`) are not editable
 * (ADR-014).
 *
 * The first three entries (ranks 3, 10, 12) were Phase 4's proof of the
 * pipeline end to end and were chosen for coverage rather than rank: three
 * brands, a $189-$395 price spread, both review scales (10.0 enthusiast and
 * 5.0 retailer/brand-direct), and a colorway count above 8 so the card's paged
 * swatch grid (ADR-015) sees real data.
 *
 * Phase 5 batch 1 added ranks 1, 2, 4 and 5. Rank 4 is a deliberate exception
 * to ADR-019: Aer's pages for both the Travel Pack 3 and the Travel Pack 3
 * Small read "This item has been discontinued and will not be restocked" and
 * name the Travel Pack 4 as the replacement, but rank 4 keeps the discontinued
 * TP3 Small rather than inheriting to the successor, because the Small has a
 * real Pack Hacker score and the Travel Pack 4 has none yet. ADR-026 records
 * that call.
 */

export type SeedPack = {
  /** Acclaim rank, 1-20. Unique across the file; the schema enforces both. */
  rank: number
  /** URL segment and image directory name — /^[a-z0-9-]+$/. */
  slug: string
  /** Model only; the brand is a separate field so the card can style them apart. */
  name: string
  brand: string
  /** Brand home page. Not the product page — that is `productUrl` in the source capture. */
  brandUrl: string
  /** Why this pack sits at this rank. ADR-018: the ordering must stay auditable. */
  rationale: string
}

export const seedPacks: SeedPack[] = [
  {
    rank: 1,
    slug: 'evergoods-civic-panel-loader-24l',
    name: 'Civic Panel Loader 24L',
    brand: 'EVERGOODS',
    brandUrl: 'https://evergoods.us',
    rationale:
      'The reference EDC pack of the current generation: Pack Hacker scores the V3 8.6/10, and '
      + 'EVERGOODS calls the CPL its award-winning bestseller of eight years running. The V3 '
      + 'refresh — solution-dyed 840D ballistic Nylon 6, padded mesh back panel, contoured straps '
      + '— answers the only durable criticism of the V2 (carry comfort) without changing the '
      + 'silhouette everyone ranks it for. (The plan also credits it as Carry Awards IX champion; '
      + 'that specific award could not be re-verified on carryology.com in Phase 5.)',
  },
  {
    rank: 2,
    slug: 'peak-design-everyday-backpack-30l',
    name: 'Everyday Backpack V2 30L',
    brand: 'Peak Design',
    brandUrl: 'https://www.peakdesign.com',
    rationale:
      'The most recognizable EDC pack made, and the one whose MagLatch and FlexFold dividers the '
      + 'rest of the category keeps answering. Pack Hacker rates the 30L V2 8.4/10 — a shade under '
      + 'the packs above it, and the review says why: it serves camera kits first and EDC second. '
      + 'Still in production seven years on, and refreshed with new colorways in 2025 rather than '
      + 'replaced.',
  },
  {
    rank: 3,
    slug: 'goruck-gr1-26l',
    name: 'GR1 26L',
    brand: 'GORUCK',
    brandUrl: 'https://www.goruck.com',
    rationale:
      'Cult status across every EDC list, a lifetime "Scars" guarantee, and the "toughest pack" '
      + 'slot in essentially every roundup. Pack Hacker scores it 8.6/10 and reviews the 26L '
      + 'specifically, which is why this entry is the 26L rather than the 21L.',
  },
  {
    rank: 4,
    slug: 'aer-travel-pack-3-small',
    name: 'Travel Pack 3 Small 28L',
    brand: 'Aer',
    brandUrl: 'https://aersf.com',
    rationale:
      'The go-anywhere pack the EDC press keeps calling one of the most beloved ever made: Pack '
      + 'Hacker scores the 28L Small 8.6/10 (form 90, value 87) and rates it 86% carry-on '
      + 'compliant, and the Small is the size that belongs on an EDC list — the standard Travel '
      + 'Pack 3 is 35L. Discontinued: Aer\'s page reads "This item has been discontinued and '
      + 'will not be restocked" and points to the Travel Pack 4 28L. Rank 4 keeps the TP3 Small '
      + 'anyway rather than inheriting to the successor, because acclaim is the ranking basis '
      + '(ADR-018) and the Travel Pack 4 has no review score yet — see ADR-026. Revisit when the '
      + 'V4 is scored.',
  },
  {
    rank: 5,
    slug: 'aer-city-pack-pro-2-20l',
    name: 'City Pack Pro 2 20L',
    brand: 'Aer',
    brandUrl: 'https://aersf.com',
    rationale:
      'The zero-regret daily driver: Pack Hacker 8.2/10, and HiConsumption called the 20L "a '
      + 'feedback-driven refresh that fixes every gripe with an already excellent EDC pack". At '
      + '$199 in 1680D CORDURA ballistic it is the cheapest pack in the top five and the only one '
      + 'sized purely for daily carry rather than travel — which is exactly the brief this rank '
      + 'is judged on.',
  },
  {
    rank: 10,
    slug: 'able-carry-max-edc',
    name: 'Max EDC 26L',
    brand: 'Able Carry',
    brandUrl: 'https://ablecarry.com',
    rationale:
      'The enthusiast darling of the current generation and a Carry Awards regular. Reviewed at '
      + '8.3/10 by Pack Hacker and rated 4.8/5 across 330 brand-direct reviews — rare agreement '
      + 'between the enthusiast press and ordinary buyers.',
  },
  {
    rank: 12,
    slug: 'alpaka-elements-backpack-pro',
    name: 'Elements Backpack Pro',
    brand: 'ALPAKA',
    brandUrl: 'https://www.alpakagear.com',
    rationale:
      'Best modern value: 26L, weatherproof AquaGuard zips and a 16" laptop sleeve at $189, a '
      + 'price point where the rest of this list is $275+. Pack Hacker 8.1/10.',
  },
]
