import type { ColorFamily } from '~/types/backpack'

/**
 * The `ColorFamily` union (ADR-022) as data, plus the free-form-name -> family
 * mapping.
 *
 * ADR-022's failure mode is ingest and the toolbar each inventing their own
 * list and silently disagreeing. This module is the single place both read
 * from: Phase 4 ingest maps names with `colorFamilyFromName`, Phase 6 facets on
 * `COLOR_FAMILIES`. Widen the union in `app/types/backpack.ts` first, then add
 * the row here — never loosen either to `string`.
 */

/**
 * Display order for the Phase 6 colour filter: neutrals, then cool, then warm,
 * then `multi`. Typed `readonly ColorFamily[]`, so dropping a member from the
 * union without updating this list is a type error rather than a filter facet
 * that quietly stops matching.
 */
export const COLOR_FAMILIES: readonly ColorFamily[] = [
  'black',
  'grey',
  'white',
  'navy',
  'blue',
  'green',
  'olive',
  'tan',
  'brown',
  'red',
  'orange',
  'purple',
  'multi',
]

const FAMILY_LABELS: Record<ColorFamily, string> = {
  black: 'Black',
  grey: 'Grey',
  white: 'White',
  navy: 'Navy',
  blue: 'Blue',
  green: 'Green',
  olive: 'Olive',
  tan: 'Tan',
  brown: 'Brown',
  red: 'Red',
  orange: 'Orange',
  purple: 'Purple',
  multi: 'Multicolour',
}

/** Human-readable family name for UI and screen-reader text. */
export function colorFamilyLabel(family: ColorFamily): string {
  return FAMILY_LABELS[family]
}

/**
 * Keyword table, evaluated **in this order** — first match wins. Order is
 * load-bearing:
 *
 * - `multi` first: "Multicam Black" is a print, not black.
 * - `navy` before `blue` and `olive` before `green`, because "Navy Blue" and
 *   "Olive Green" contain both and ADR-022 keeps those splits deliberately.
 * - `olive` before `tan`, so the fixture's "Desert Palm" resolves on `palm`
 *   rather than `desert`.
 * - `white` before `tan`/`brown`, so "Bone White" is not caught by `bone`-ish
 *   neutrals added later.
 */
const FAMILY_KEYWORDS: ReadonlyArray<readonly [ColorFamily, readonly string[]]> = [
  ['multi', ['multicam', 'camo', 'print', 'plaid', 'floral', 'tie-dye', 'tie dye', 'colorblock', 'colour block', 'geo']],
  ['navy', ['navy', 'midnight', 'indigo']],
  ['olive', ['olive', 'drab', 'fatigue', 'palm']],
  ['white', ['white', 'bone', 'ivory', 'cream', 'chalk', 'snow', 'natural']],
  ['black', ['black', 'jet', 'onyx', 'noir', 'raven', 'ink']],
  ['grey', ['grey', 'gray', 'charcoal', 'graphite', 'slate', 'ash', 'silver', 'smoke', 'granite', 'gunmetal', 'steel', 'storm']],
  ['blue', ['blue', 'cobalt', 'teal', 'denim', 'sky', 'pond', 'azure']],
  ['green', ['green', 'forest', 'emerald', 'moss', 'pine', 'jade', 'sage', 'spruce']],
  ['tan', ['tan', 'khaki', 'sand', 'desert', 'beige', 'oat', 'dune', 'camel', 'wheat']],
  ['brown', ['brown', 'coyote', 'espresso', 'chocolate', 'coffee', 'peppercorn', 'walnut', 'mocha', 'chestnut', 'cognac', 'tobacco']],
  ['red', ['red', 'burgundy', 'oxblood', 'maroon', 'crimson', 'wine', 'brick', 'cardinal']],
  ['orange', ['orange', 'rust', 'clay', 'terracotta', 'copper', 'amber']],
  ['purple', ['purple', 'plum', 'violet', 'lavender', 'aubergine', 'eggplant']],
]

/**
 * Map a free-form colorway name ("Ranger Green", "Peppercorn") onto a
 * `ColorFamily`.
 *
 * Returns `null` when nothing matches, deliberately: a silent fallback to
 * `multi` would bucket every unrecognized name into one facet and hide the gap.
 * Callers decide — Phase 4 ingest should fail the build (ADR-022) or take an
 * explicit `family` from `data/sources/{slug}.json`, which always wins over
 * this guess.
 */
export function colorFamilyFromName(name: string): ColorFamily | null {
  const haystack = name.toLowerCase()
  for (const [family, keywords] of FAMILY_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return family
  }
  return null
}
