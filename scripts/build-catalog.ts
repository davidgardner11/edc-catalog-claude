/**
 * Stage 3 — merge `data/seed.ts` (judgement) with `data/sources/{slug}.json`
 * (measurement) and the emitted image dimensions, validate the result against
 * the zod schema, and write `app/data/catalog.json`.
 *
 * Two classes of failure, deliberately handled differently:
 *
 *   - **Missing artefacts** (a pack whose images never downloaded) are isolated:
 *     the pack is dropped, the rest of the catalog still builds, and the run
 *     exits non-zero with a summary. One blocked retailer must not cost you
 *     nineteen packs.
 *   - **Bad data** (an unmappable colour name, a malformed hex, a duplicate
 *     rank) fails the whole build and writes nothing. These are authoring
 *     errors in files a human just edited, and a half-written catalog would ship
 *     a silently wrong card. "zod validates before write" (CLAUDE.md).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { colorFamilyFromName } from '../app/utils/color.ts'
import type { Backpack, Colorway } from '../app/types/backpack.ts'
import { seedPacks, type SeedPack } from '../data/seed.ts'
import { readSource } from './fetch-images.ts'
import { describeError, logger, type PackFailure } from './lib/log.ts'
import { CATALOG_PATH, rel } from './lib/paths.ts'
import { catalogSchema, formatIssues, IMAGE_WIDTHS } from './lib/schema.ts'
import type { ProcessStamp } from './process-images.ts'
import type { SourceCapture } from './lib/schema.ts'

const log = logger('catalog')

/**
 * ADR-022: map free-form marketing names onto the closed `ColorFamily` union
 * using the *same* helper the Phase 6 colour filter is built from. An explicit
 * `family` in the source capture wins — the keyword table cannot know that
 * "Black Tiger Stripe" is a print or that "Desert Brown" is brown rather than
 * tan.
 *
 * A name that maps to nothing **fails the build**. `colorFamilyFromName`
 * returns `null` by design rather than defaulting to `multi`, because a default
 * would bucket every unrecognised colorway into one facet and hide the gap
 * forever. The fix is to add a keyword to `app/utils/color.ts` (so the filter
 * learns it too) or to set `family` explicitly in the capture.
 */
function resolveColorways(source: SourceCapture): Colorway[] {
  return source.colorways.map((colorway) => {
    const family = colorway.family ?? colorFamilyFromName(colorway.name)
    if (family === null) {
      throw new Error(
        `colorway "${colorway.name}" maps to no ColorFamily. Add a keyword to `
          + `app/utils/color.ts so the Phase 6 filter learns it too, or set "family" `
          + `explicitly in data/sources/${source.slug}.json.`,
      )
    }
    return { name: colorway.name, hex: colorway.hex, family }
  })
}

function buildPack(seed: SeedPack, source: SourceCapture, stamp: ProcessStamp): Backpack {
  const images = [...stamp.images]
    .sort((a, b) => a.index - b.index)
    .map((processed) => {
      const spec = source.images[processed.index]
      const alt =
        spec?.alt
        ?? `${seed.brand} ${seed.name} — view ${processed.index + 1} of ${stamp.images.length}`
      return {
        base: `/images/${seed.slug}/${processed.index}`,
        widths: [...IMAGE_WIDTHS],
        width: processed.width,
        height: processed.height,
        alt,
      }
    })

  // Key order is written out explicitly and never derived from Object.keys of
  // an input, so JSON.stringify emits the same bytes on every machine.
  return {
    rank: seed.rank,
    slug: seed.slug,
    name: seed.name,
    brand: seed.brand,
    images,
    colorways: resolveColorways(source),
    price: {
      amountUsd: source.price.amountUsd,
      retailer: source.price.retailer,
      url: source.price.url,
      capturedAt: source.price.capturedAt,
    },
    review: {
      score: source.review.score,
      scale: source.review.scale,
      source: source.review.source,
      url: source.review.url,
      capturedAt: source.review.capturedAt,
    },
    ...(source.specs && Object.keys(source.specs).length > 0 ? { specs: source.specs } : {}),
  }
}

export type BuildResult = {
  written: number
  failures: PackFailure[]
}

export async function buildCatalog(
  seeds: SeedPack[],
  stamps: Map<string, ProcessStamp>,
): Promise<BuildResult> {
  log.banner('build-catalog')

  const packs: Backpack[] = []
  const failures: PackFailure[] = []
  /** Authoring errors — these abort the write rather than dropping a pack. */
  const fatal: string[] = []

  // Rank order is the catalog's default order (ADR-018) and, more importantly,
  // a stable one: filesystem iteration order must never reach the output.
  for (const seed of [...seeds].sort((a, b) => a.rank - b.rank)) {
    const stamp = stamps.get(seed.slug)
    if (!stamp || stamp.images.length === 0) {
      failures.push({ slug: seed.slug, stage: 'build-catalog', reason: 'no processed images' })
      log('warn', `${seed.slug}: no processed images — omitted from the catalog`)
      continue
    }
    try {
      packs.push(buildPack(seed, await readSource(seed.slug), stamp))
    } catch (error) {
      fatal.push(`${seed.slug}: ${describeError(error)}`)
      log('fail', `${seed.slug}: ${describeError(error)}`)
    }
  }

  if (fatal.length > 0) {
    throw new Error(
      `${fatal.length} pack(s) have unusable source data; nothing was written:\n  ${fatal.join('\n  ')}`,
    )
  }

  const validated = catalogSchema.safeParse(packs)
  if (!validated.success) {
    throw new Error(
      `catalog failed schema validation; ${rel(CATALOG_PATH)} was NOT written:\n`
        + formatIssues(validated.error),
    )
  }

  await mkdir(dirname(CATALOG_PATH), { recursive: true })
  // Two-space indent and a trailing newline: a stable, diffable shape. Object
  // key order comes from buildPack, so the bytes are a pure function of the input.
  await writeFile(CATALOG_PATH, `${JSON.stringify(validated.data, null, 2)}\n`, 'utf8')
  log('write', `${rel(CATALOG_PATH)} — ${validated.data.length} pack(s), schema-valid`)

  return { written: validated.data.length, failures }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readStampsForSlugs } = await import('./lib/stamps.ts')
  const stamps = await readStampsForSlugs(seedPacks.map((p) => p.slug))
  const { failures } = await buildCatalog(seedPacks, stamps)
  process.exit(failures.length > 0 ? 1 : 0)
}
