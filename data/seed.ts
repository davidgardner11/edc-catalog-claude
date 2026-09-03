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
 * Currently three of the plan's twenty. Phase 5 fills in the rest; the three
 * here exist to prove the pipeline end to end and were chosen for coverage
 * rather than rank: three brands, a $189-$395 price spread, both review scales
 * (10.0 enthusiast and 5.0 retailer/brand-direct), and a colorway count above
 * 8 so the card's paged swatch grid (ADR-015) sees real data.
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
