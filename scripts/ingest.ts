/**
 * `pnpm ingest` — the build-time pipeline that turns `data/` into
 * `app/data/catalog.json` and `public/images/`.
 *
 *     data/seed.ts + data/sources/{slug}.json
 *       -> fetch-images    -> .ingest-cache/{slug}/          (gitignored originals)
 *       -> process-images  -> public/images/{slug}/{n}-{w}.{avif,webp}
 *       -> build-catalog   -> app/data/catalog.json          (zod-validated)
 *
 * There is no server in this project (ADR-007); this script *is* the backend.
 * Its two contractual guarantees (ADR-014):
 *
 *   1. unchanged inputs produce byte-identical outputs, and
 *   2. deleting `public/images/` costs a re-encode, never a re-download.
 *
 * Flags:
 *   --only=slug[,slug]   restrict the run to named packs
 *   --skip-fetch         process and build from the cache only; no network
 *   --reencode           ignore encode stamps and re-encode every variant
 *
 * Environment:
 *   INGEST_OFFLINE=1     make any outbound request throw. A run that still
 *                        succeeds has provably touched no network.
 *   INGEST_REENCODE=1    equivalent to --reencode; either one alone is enough.
 *
 * Flags are parsed here and passed to each stage as arguments; no stage reads
 * an option out of `process.env` that this file wrote. See KNOWN_FLAGS below.
 */
import { seedPacks } from '../data/seed.ts'
import { buildCatalog } from './build-catalog.ts'
import { fetchImages, readSource } from './fetch-images.ts'
import { processImages, reencodeRequestedByEnv } from './process-images.ts'
import { networkRequestCount } from './lib/http.ts'
import { describeError, logger, type PackFailure } from './lib/log.ts'
import { readStampsForSlugs } from './lib/stamps.ts'

const log = logger('ingest')

const args = process.argv.slice(2)

/**
 * Every flag is parsed here, in this module's own body, and then **passed down
 * as an argument**. Nothing writes to `process.env` to communicate with a stage.
 *
 * That rule exists because breaking it is invisible: a stage that captures
 * `process.env.X` at module scope has already read it by the time this body
 * runs — ESM evaluates a statically imported module before its importer — so
 * the assignment lands too late and the flag does nothing, without an error.
 * `--reencode` shipped broken exactly that way and its "forced re-encode" run
 * was silently a no-op. Options are arguments now, and the env vars that remain
 * are read at call time inside the stage that owns them.
 */
const KNOWN_FLAGS = ['--skip-fetch', '--reencode'] as const

const onlyArg = args.find((a: string) => a.startsWith('--only='))
const skipFetch = args.includes('--skip-fetch')
// Flag OR env var — a single boolean decided in one place. Combining them with
// `??` at the stage instead would make the env var dead whenever this file
// passes an explicit `false`, i.e. always: the same silent no-op, relocated.
const reencode = args.includes('--reencode') || reencodeRequestedByEnv()

// A mistyped flag must not look like a successful run that quietly did less.
const unrecognised = args.filter(
  (a: string) => !a.startsWith('--only=') && !(KNOWN_FLAGS as readonly string[]).includes(a),
)
if (unrecognised.length > 0) {
  log('fail', `unrecognised argument(s): ${unrecognised.join(', ')}`)
  log('fail', `usage: pnpm ingest [--only=slug[,slug]] [${KNOWN_FLAGS.join('] [')}]`)
  process.exit(1)
}

const requested = onlyArg?.slice('--only='.length).split(',').map((s: string) => s.trim()).filter(Boolean)
const seeds = requested ? seedPacks.filter((p) => requested.includes(p.slug)) : seedPacks

if (requested) {
  const unknown = requested.filter((slug: string) => !seedPacks.some((p) => p.slug === slug))
  if (unknown.length > 0) {
    log('fail', `--only names slugs that are not in data/seed.ts: ${unknown.join(', ')}`)
    process.exit(1)
  }
}
if (seeds.length === 0) {
  log('fail', 'data/seed.ts is empty — nothing to ingest.')
  process.exit(1)
}

const slugs = seeds.map((p) => p.slug)
const failures: PackFailure[] = []

/**
 * Preflight: validate every research capture before any stage runs.
 *
 * A malformed `data/sources/{slug}.json` is an authoring error in a file a
 * human just edited, not a transient network condition — so it fails the whole
 * run immediately, writes nothing, and leaves the previous catalog intact.
 * Reaching this failure only at the end, after minutes of encoding, would be
 * strictly worse feedback for exactly the same outcome.
 */
log.banner('preflight')
const invalid: string[] = []
for (const slug of slugs) {
  try {
    await readSource(slug)
    log('info', `${slug}: capture is schema-valid`)
  } catch (error) {
    invalid.push(`${slug}: ${describeError(error)}`)
  }
}
if (invalid.length > 0) {
  for (const problem of invalid) log('fail', problem)
  log('fail', `${invalid.length} research capture(s) are unusable. Nothing was written.`)
  process.exit(1)
}

if (skipFetch) {
  log('info', '--skip-fetch: rebuilding from .ingest-cache/ only')
} else {
  failures.push(...(await fetchImages(slugs)).failures)
}

// Every pack that has anything cached is processed, including ones whose fetch
// partially failed — a pack with 3 of 5 images is still a usable card.
failures.push(...(await processImages(slugs, { reencode })).failures)

try {
  const stamps = await readStampsForSlugs(slugs)
  const { written, failures: buildFailures } = await buildCatalog(seeds, stamps)
  failures.push(...buildFailures)

  log.banner('summary')
  log('info', `${written}/${seeds.length} pack(s) in the catalog`)
  log('info', `${networkRequestCount()} network request(s) this run`)
} catch (error) {
  // Thrown only for authoring errors and schema violations, which are fatal by
  // design: nothing was written, so the previous catalog is still intact.
  log.banner('summary')
  log('fail', describeError(error))
  process.exit(1)
}

if (failures.length > 0) {
  for (const failure of failures) log('fail', `${failure.slug} [${failure.stage}] ${failure.reason}`)
  log(
    'fail',
    `${failures.length} pack-level failure(s). The catalog was written without them; `
      + 'fix the capture in data/sources/ and re-run — cached packs will not be re-fetched.',
  )
  process.exit(1)
}

log('info', 'ok')
