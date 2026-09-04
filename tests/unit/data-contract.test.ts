import { describe, expect, it } from 'vitest'
import { catalogBackpacks, catalogByRank, findBackpack } from '../../app/data/catalog'
import catalogJson from '../../app/data/catalog.json'
import { formatCapturedDate } from '../../app/utils/format'
import { catalogSchema, formatIssues } from '../../scripts/lib/schema.ts'

/**
 * `app/data/catalog.json` is a **committed build artifact** (ADR-030) that must
 * never be hand-edited (ADR-014). Ingest validates it against `catalogSchema`
 * at the moment it is written — but nothing re-checks it afterwards, and the
 * two ways it changes without ingest running are exactly the two ADR-030 warns
 * about: someone editing a price by hand, and someone resolving a merge
 * conflict in the JSON rather than re-running the pipeline.
 *
 * So this file validates the artifact **as committed**, against the pipeline's
 * own schema rather than a restatement of it — a second list of rules here
 * would be the ADR-022 failure mode all over again. Everything the schema
 * cannot express, and that a component or an E2E assertion relies on, is
 * asserted below it.
 *
 * These tests read no network and no image bytes: `public/images/` is gitignored
 * (ADR-012) and may legitimately be empty.
 */

describe('app/data/catalog.json satisfies the ingest schema', () => {
  it('parses cleanly — a failure here means the artifact was edited by hand', () => {
    const result = catalogSchema.safeParse(catalogJson)
    expect(result.success ? '' : formatIssues(result.error)).toBe('')
  })
})

describe('the typed catalog module', () => {
  it('exposes the JSON unchanged', () => {
    expect(catalogBackpacks).toEqual(catalogJson)
  })

  it('orders catalogByRank ascending and holds every pack exactly once', () => {
    const ranks = catalogByRank.map((pack) => pack.rank)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(catalogByRank).toHaveLength(catalogBackpacks.length)
    expect(new Set(catalogByRank.map((p) => p.slug))).toEqual(
      new Set(catalogBackpacks.map((p) => p.slug)),
    )
  })

  it('does not sort catalogBackpacks in place', () => {
    // `catalogByRank` is derived at module scope; if it had sorted the shared
    // array the two would be identical objects and every consumer would see the
    // rank order whether or not it asked for it.
    expect(catalogByRank).not.toBe(catalogBackpacks)
  })

  it('finds a pack by slug and returns undefined for an unknown one', () => {
    const first = catalogBackpacks[0]!
    expect(findBackpack(first.slug)).toBe(first)
    expect(findBackpack('no-such-pack')).toBeUndefined()
  })

  // ADR-033: ranks 7 and 16 are reserved and absent, so position is not rank.
  it('has sparse ranks — never index by rank', () => {
    const ranks = new Set(catalogByRank.map((pack) => pack.rank))
    expect(ranks.has(7)).toBe(false)
    expect(ranks.has(16)).toBe(false)
    expect(catalogByRank.every((pack, i) => pack.rank === i + 1)).toBe(false)
  })
})

describe('invariants the schema cannot express', () => {
  const packs = catalogBackpacks

  it.each(packs.map((pack) => [pack.slug, pack] as const))(
    '%s: image bases are /images/{slug}/{i}, indexed from 0 with no gaps',
    (slug, pack) => {
      // `CarouselImage.base` is the only coupling between the catalog and the
      // files ingest writes to `public/images/`. If the slug or the index drift,
      // every variant 404s and nothing else in the app notices.
      expect(pack.images.map((image) => image.base)).toEqual(
        pack.images.map((_, i) => `/images/${slug}/${i}`),
      )
    },
  )

  it.each(packs.map((pack) => [pack.slug, pack] as const))(
    '%s: alt text is a real description, not a filename',
    (_slug, pack) => {
      for (const image of pack.images) {
        expect(image.alt.trim().length).toBeGreaterThan(0)
        expect(image.alt).not.toMatch(/\.(avif|webp|jpe?g|png)$/i)
      }
    },
  )

  // ADR-009: a capture date the UI cannot render is worse than none — the UI's
  // whole job with these is to say "captured on", never to imply live data.
  it.each(packs.map((pack) => [pack.slug, pack] as const))(
    '%s: both capturedAt stamps render as a date',
    (_slug, pack) => {
      expect(formatCapturedDate(pack.price.capturedAt)).not.toBe('')
      expect(formatCapturedDate(pack.review.capturedAt)).not.toBe('')
    },
  )

  it('carries at least one pack on each review scale, so both display paths ship', () => {
    const scales = new Set(packs.map((pack) => pack.review.scale))
    expect([...scales].sort((a, b) => a - b)).toEqual([5, 10])
  })
})
