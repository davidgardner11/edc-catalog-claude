import type { Backpack } from '~/types/backpack'
import catalogJson from './catalog.json'

/**
 * The catalog, typed. This module is the **only** place `catalog.json` is
 * imported, so the one unavoidable cast lives here rather than at every call
 * site (ADR-034).
 *
 * The cast is safe by construction, not by assertion: `scripts/build-catalog.ts`
 * validates the file against the zod schema before writing it, and the build
 * fails loudly rather than emitting anything that does not match `Backpack`
 * (ADR-025). Re-validating here would ship zod to the browser to re-check data
 * that cannot have changed since the build — the file is a build artifact,
 * bundled, not fetched (ADR-004: there is no runtime data fetching).
 *
 * The `unknown` hop is required because TypeScript infers `family: string` from
 * the JSON literal, which is not assignable to the closed `ColorFamily` union
 * (ADR-022). Widening `ColorFamily` to `string` to avoid it would defeat the
 * entire point of that ADR.
 */
export const catalogBackpacks: Backpack[] = catalogJson as unknown as Backpack[]

/**
 * Acclaim rank is the catalog's canonical order (ADR-018). Ranks are sparse —
 * 7 and 16 are reserved and absent (ADR-033) — so never index by rank or
 * assume `rank === position + 1`.
 *
 * Sorted once, here, at module scope: the detail route's prev/next neighbours
 * are the only consumer and used to re-derive the identical sort per component
 * instance (ADR-036). Import this rather than sorting `catalogBackpacks` again.
 */
export const catalogByRank: Backpack[] = [...catalogBackpacks].sort((a, b) => a.rank - b.rank)

/** `undefined` for an unknown slug; the detail route turns that into a 404. */
export function findBackpack(slug: string): Backpack | undefined {
  return catalogBackpacks.find((pack) => pack.slug === slug)
}
