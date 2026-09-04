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
 *
 * Phase 5 batch 2 covered ranks 6-11 and added only ranks 6 and 9, because it
 * found ranks 8 and 11 discontinued and rank 7 unreadable. ADR-031 then decided
 * both discontinued ranks inherit to their successors, as ADR-019 did for the
 * Citadel R2 → R3. The batch 2 follow-up captured one of the two:
 *
 *   - Rank 11 → Mission Workshop Rhake LS. Captured. In production and in
 *     stock, $525 brand-direct, VX-21, 22L — the figures ADR-031 carried are
 *     confirmed. Rationale below marks the rank as inherited.
 *   - Rank 8 → Mystery Ranch. RETIRED, not inherited (ADR-032). The designated
 *     successor is itself discontinued: mysteryranch.com 301-redirects
 *     /catalyst-26-pack to /Packs/Outdoor while control products still return
 *     200; the storefront's own commerce API holds 163 items and no Catalyst at
 *     any size; and its Everyday Carry category is down to 12 items. This is
 *     the brand exiting the category, not a URL move — YETI is retooling the
 *     Mystery Ranch consumer line into YETI and keeping only the military,
 *     wildfire and hunting business. There is no inheritance path left inside
 *     the brand, so the slot was retired and every rank below it moved up one.
 *     The list is now 19 packs and 18 brands.
 *   - Rank 7, Bellroy Classic Backpack Plus — in production, but no field
 *     could be verified. bellroy.com renders client-side and served no product
 *     content to any fetch, and every US retailer refused: Amazon HTTP 500,
 *     REI HTTP 403, Huckberry HTTP 403, Nordstrom's listing sold out.
 *
 * Phase 5 batches 3 and 4 covered every remaining rank - 7 and 12-19 - and
 * added seven: 12, 13, 14, 15, 17, 18 and 19. That brings the file to 17 of the
 * ranked 19. Three of the seven needed a note here:
 *
 *   - Rank 13, Osprey Daylite Plus, is the deepest retailer fallback in the
 *     catalog. osprey.com returned HTTP 403 on every path tried, including its
 *     own robots.txt, as did REI, Dick's and Scuba.com; the price, the 14
 *     colorways and every swatch photograph come from Outdoor Gear Exchange and
 *     Active Endeavors instead. ADR-009's fallback chain is doing real work
 *     here, and no brand-direct figure was ever read.
 *   - Rank 17 is now named 'Barrage 22L Pack', not the plan's 'Barrage Cargo
 *     Backpack'. Chrome restructured the line into fixed-name products and the
 *     old URL 404s; the pack is the same one - same Pack Hacker review URL,
 *     same cargo-net rolltop - and its current spec block reads 19-22L, one
 *     liter off the plan's '18->22L'. This is a rename, not an inheritance:
 *     ADR-019 does not apply and the rank is not marked inherited.
 *   - Rank 19's product copy no longer says 'ballistic nylon' anywhere. Filson
 *     now calls it 1000D nylon; Huckberry still lists the identical pack under
 *     the old name, which is what confirmed the match against the plan's
 *     'Dryden Ballistic Nylon'.
 *
 * Two ranks are still absent, both for the same reason - a required field could
 * not be read live - and both need a human, because filling either one means
 * either substituting a product or accepting an unverified number:
 *
 *   - Rank 7, Bellroy Classic Backpack Plus. Retried in batch 3 and got
 *     further than batch 2 without getting there. Confirmed in production, and
 *     a real Pack Hacker score now exists (8.0/10, updated 2023-06-19), along
 *     with usable photographs and a colorway list. THE BLOCKER IS PRICE ALONE,
 *     which is a required field. bellroy.com is a client-rendered SPA with no
 *     JSON-LD and no Shopify product endpoints (confirmed 404, so it is not
 *     Shopify); Amazon 500, REI 403, Huckberry 403, Nordstrom and Nordstrom
 *     Rack sold out, Zappos and Backcountry unusable. Two USD figures exist but
 *     neither was read off a live retailer page: Pack Hacker's article text
 *     cites $189 direct in a review over three years old, and Carryology cites
 *     $179. A Philippine retailer has it live and in stock at PHP 13,005
 *     (roughly $208), deliberately not converted - local market pricing is not
 *     a US retail price point, and laundering it into amountUsd would make
 *     'lowest available price' false (ADR-017).
 *   - Rank 16, Incase ICON Slim. Neither discontinued nor purchasable. The
 *     product page is live and still merchandised in the current Backpacks
 *     collection at $129.99, but reads 'Coming Soon' with 0 in stock and no Add
 *     to Cart; no retailer carries this SKU (the Best Buy, B&H and Amazon
 *     listings found are an older generation with different SKUs and
 *     colorways); and Pack Hacker has never reviewed the Slim - it has scored
 *     the ICON Backpack 7.7/10 and the ICON Lite 7.3/10, which are different
 *     packs and not borrowable (ADR-009). So both price and review are
 *     unverifiable. This is not the Mystery Ranch case that ADR-032 retired:
 *     the page is current and not redirected, so there is no evidence the brand
 *     has exited. Note the brand's own page contradicts itself on capacity -
 *     the title says 'ICON Slim Backpack - 19L' and the spec string on the same
 *     page says '19 x 12 x 8 in x 14.5L'.
 *
 * DECIDED 2026-09-03: both ranks stay absent and get revisited, rather than
 * being retired, substituted or filled with an unverified number. Rank 7 is a
 * fetch failure and not a product failure - Bellroy has not left the category,
 * so ADR-032's retirement is the wrong instrument, and the $189 and $179
 * figures that exist are article text rather than a live retailer page. Rank 16
 * is on a current, non-redirected page whose 'Coming Soon' most likely resolves
 * on its own. The catalog therefore ships 17 of 19 with every price and score
 * live-verified, which was preferred to 19 of 19 with two soft numbers in it.
 *
 * Ranks are NOT renumbered around the two gaps: 7 and 16 stay reserved for
 * these packs. Recapture is the intended path, so re-check both - Bellroy for a
 * readable price, Incase for stock plus a Slim-specific review - before
 * concluding anything further about either. Substituting a different pack for
 * either rank remains a ranking decision (ADR-019, ADR-026, ADR-031) needing a
 * human and an ADR, not a substitution by the agent that found the gap.
 */

export type SeedPack = {
  /** Acclaim rank, 1-19 since ADR-032 retired rank 8. Unique across the file; the schema enforces uniqueness and a 1-20 ceiling. */
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
    rank: 6,
    slug: 'tom-bihn-synapse-19',
    name: 'Synapse 19',
    brand: 'TOM BIHN',
    brandUrl: 'https://www.tombihn.com',
    rationale:
      'The long-running cult classic of the category, and the only pack on this list still cut and '
      + 'sewn in the United States by the brand that designs it — TOM BIHN makes it in its own '
      + 'Seattle factory and sells it direct, with no wholesale channel. The Synapse\'s radial '
      + 'pocket layout has been imitated for over a decade and never really improved on, and the '
      + 'design has survived that long without a redesign, only new fabrics. This is the 19L; the '
      + 'Synapse 25 is a separate, larger pack. Brand-direct rating 4.9/5 across 397 reviews — a '
      + 'number ADR-018 explicitly refuses to read as popularity, since tombihn.com is the pack\'s '
      + 'sole sales channel, but which does corroborate the critical standing this rank rests on.',
  },
  {
    rank: 8,
    slug: 'black-ember-citadel-r3-25l',
    name: 'Citadel R3 25L',
    brand: 'Black Ember',
    brandUrl: 'https://blackember.com',
    rationale:
      'Best weatherproof pack on the list: a modular hardshell in Black Ember\'s PFAS-free EmberTex '
      + '1220x600 nylon 6 with YKK AquaGuard zips throughout. The rank is inherited, not earned '
      + 'by this model: ADR-019 carried it forward from the discontinued Citadel R2, whose '
      + 'critical reception put Black Ember here, and the R3 has not been reviewed into this '
      + 'position independently. Phase 5 looked for one and found none: Pack Hacker has never '
      + 'scored an R3, and the R3 reviews that exist (Nomads Nation, Danny Packs) assign no number. '
      + 'The only R3-specific score in the capture is the brand\'s own 4.77/5 from 31 reviews. '
      + 'Revisit the placement if enthusiast coverage of the R3 ever appears.',
  },
  {
    rank: 9,
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
    rank: 10,
    slug: 'mission-workshop-rhake-ls',
    name: 'Rhake LS 22L',
    brand: 'Mission Workshop',
    brandUrl: 'https://missionworkshop.com',
    rationale:
      'The commuter and cycling specialist of the list, and the only pack here cut from Dimension '
      + 'Polyant VX-21 sailcloth and made in the USA at this price. The rank is inherited, not '
      + 'earned by this model: ADR-031 carried it forward from the discontinued Rhake VX, whose '
      + 'critical reception — Carryology, Macworld and HiConsumption all reviewed it as the '
      + 'benchmark weatherproof laptop pack — put Mission Workshop here. The LS is a genuine '
      + 'redesign rather than a re-release, adding the LandSpeeder modular attachment system, '
      + 'Fidlock magnetic front buckles and a new harness and back panel. Its own reception is '
      + 'thin and not yet flattering: Pack Hacker has never scored any Rhake, and the single '
      + 'numeric review of the LS itself — Nomads Nation, 3.75/5 — praises the materials (4.5/5) '
      + 'while marking it down hard on value (3/5) at $525, the most expensive pack on this list. '
      + 'That is a weaker case than the rank implies, so revisit the placement once enthusiast '
      + 'coverage of the LS appears.',
  },
  {
    rank: 11,
    slug: 'alpaka-elements-backpack-pro',
    name: 'Elements Backpack Pro',
    brand: 'ALPAKA',
    brandUrl: 'https://www.alpakagear.com',
    rationale:
      'Best modern value: 26L, weatherproof AquaGuard zips and a 16" laptop sleeve at $189, a '
      + 'price point where the rest of this list is $275+. Pack Hacker 8.1/10.',
  },
  {
    rank: 12,
    slug: 'topo-designs-rover-pack-tech',
    name: 'Rover Pack Tech',
    brand: 'Topo Designs',
    brandUrl: 'https://topodesigns.com',
    rationale:
      'Heritage American design at the most accessible price in the top half of this list: 24.3L of '
      + '1000D recycled nylon at $149, where everything ranked above it starts at $175. Pack Hacker '
      + 'scores the Tech version 8.0/10 — a higher score than the five packs beneath it and than some '
      + 'above — so the rank reflects a thinner award record rather than a weaker review. In '
      + 'production; Navy in stock, Black a live listing currently sold out.',
  },
  {
    rank: 13,
    slug: 'osprey-daylite-plus-20l',
    name: 'Daylite Plus 20L',
    brand: 'Osprey',
    brandUrl: 'https://www.osprey.com',
    rationale:
      'The highest-volume seller on the list by a wide margin, and the cheapest pack on it at $79.95 '
      + '— 14 colorways carried through dozens of outdoor retailers. It earns the slot on ubiquity '
      + 'rather than acclaim, and Pack Hacker\'s 7.0/10 is the lowest score in the catalog, so this '
      + 'is the one rank where the list is closest to the popularity term ADR-018 rejected. Revisit '
      + 'it first if the ordering is ever re-argued. osprey.com refused every automated request; the '
      + 'price and colorways come from Outdoor Gear Exchange — see the capture notes.',
  },
  {
    rank: 14,
    slug: 'wandrd-prvke-21',
    name: 'PRVKE 21L',
    brand: 'WANDRD',
    brandUrl: 'https://www.wandrd.com',
    rationale:
      'The photo/EDC crossover standard: a roll-top pack built around a removable padded camera cube, '
      + 'which is why it appears on camera-bag lists and EDC lists alike. $234 bag-only, Pack Hacker '
      + '7.5/10 — though that review never names the V4 generation this capture prices, so confirm it '
      + 'is scoring the current pack before leaning on the number.',
  },
  {
    rank: 15,
    slug: 'the-brown-buffalo-concealpack-21l',
    name: 'ConcealPack 21L',
    brand: 'The Brown Buffalo',
    brandUrl: 'https://www.thebrownbuffalo.com',
    rationale:
      'The best small-batch entry: a weather-resistant 1050D CORDURA pack from a genuinely small US '
      + 'operation, at $229 both brand-direct and at Nordstrom. Pack Hacker 7.5/10.',
  },
  {
    rank: 17,
    slug: 'chrome-industries-barrage-22l-pack',
    name: 'Barrage 22L Pack',
    brand: 'Chrome Industries',
    brandUrl: 'https://chromeindustries.com',
    rationale:
      'Messenger heritage carried into a backpack: a welded waterproof tarp liner, external cargo '
      + 'net and the seatbelt-buckle sternum strap Chrome is known for, at $175. Pack Hacker 7.3/10. '
      + 'The plan names this the "Barrage Cargo Backpack"; Chrome has since restructured the line '
      + 'into fixed-name products and the same pack — same review URL, same cargo-net rolltop — now '
      + 'ships as the Barrage 22L Pack, spec\'d 19–22L rather than the plan\'s 18→22L.',
  },
  {
    rank: 18,
    slug: 'arktype-dashpack-ii',
    name: 'Dashpack II',
    brand: 'ARKTYPE',
    brandUrl: 'https://www.arktypedesign.com',
    rationale:
      'The minimalist favorite: a slim 15L commuter pack in 1680D ballistic nylon with AquaGuard '
      + 'zips, handmade in the USA, at $198. The smallest brand on this list and confirmed still in '
      + 'production. Pack Hacker scores the Dashpack 7.6/10, but that review carries no Mark II '
      + 'marker and may predate this pack\'s interior-only refresh — the fabric and capacity are '
      + 'unchanged, so the score is likely still representative. Revisit if a Mark II score appears.',
  },
  {
    rank: 19,
    slug: 'filson-dryden-backpack',
    name: 'Dryden Backpack',
    brand: 'Filson',
    brandUrl: 'https://www.filson.com',
    rationale:
      'The heritage/professional entry: 1000D nylon in a ballistic weave with bridle-leather trim '
      + 'and Filson\'s buy-it-for-life positioning, at $279. Pack Hacker 7.6/10. The plan calls this '
      + 'the "Dryden Ballistic Nylon" to separate it from the Tin Cloth and Rugged Twill Drydens; '
      + 'Filson\'s own copy has since dropped the phrase "ballistic nylon", and it was Huckberry\'s '
      + 'listing — still using the old name for the identical pack — that confirmed the match.',
  },
]
