/**
 * `pnpm sample-swatch` — derive a colorway's `hex` from the brand's own
 * photograph of that colorway, by the method ADR-025 pinned:
 *
 *   > the median-luminance pixel of the central 40% of that photograph with
 *   > the background discarded
 *
 * This is not a new method. Phase 4 sampled GORUCK's thirteen colorways by hand
 * this way and recorded a `swatchSource` for each; this script exists because
 * doing it ad hoc is exactly why the four Phase 5 batch-1 captures shipped
 * name-derived hexes with no `swatchSource` at all. ADR-025 is explicit that a
 * hex without a `swatchSource` is an unsourced claim.
 *
 * It is deliberately *not* part of `pnpm ingest`. Ingest reads `hex` out of the
 * capture; sampling is an authoring aid whose output a human pastes into
 * `data/sources/{slug}.json` along with the URL it came from. Making it a
 * pipeline stage would mean the catalog's colours could change without any
 * tracked file changing — the opposite of ADR-014.
 *
 * Usage:
 *   pnpm sample-swatch <url> [<url>...]     sample one or more photographs
 *   pnpm sample-swatch --check=<slug>       re-sample every colorway in
 *                                           data/sources/<slug>.json that has a
 *                                           swatchSource, and diff the result
 *                                           against the committed hex
 *   pnpm sample-swatch --json <url>...      machine-readable output on stdout
 *
 * Exit code is 1 when a photograph could not be sampled at all — unreachable,
 * or a colorway with no `swatchSource`. It is **0** when a sampled hex merely
 * differs from the committed one: that is information, not a build break, and
 * the two values disagreeing is precisely the case where a human has to decide
 * which is wrong rather than have the tool overwrite the evidence.
 *
 * Environment:
 *   INGEST_OFFLINE=1   any outbound request throws (see lib/http.ts). A
 *                      `--check` run that still succeeds proves it re-sampled
 *                      from cache and re-downloaded nothing.
 *
 * **Determinism.** Same URL in, same hex out, for the same reasons
 * `process-images.ts` is deterministic (ADR-025): originals are cached and
 * re-read rather than re-fetched, the crop is integer arithmetic, no resampling
 * or resizing happens before the sample, and the median is taken over a total
 * order — luminance first, then r, g, b — so a tie between two pixels of equal
 * luminance cannot resolve differently between runs.
 *
 * Flags are parsed in this module's own body and passed down as arguments; no
 * option travels through `process.env` (ADR-025).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { fetchAsset, networkRequestCount } from './lib/http.ts'
import { describeError, logger } from './lib/log.ts'
import { SWATCH_CACHE_DIR, rel, sourcePathFor } from './lib/paths.ts'
import { formatIssues, sourceSchema } from './lib/schema.ts'

const log = logger('swatch')

// Same determinism settings as process-images.ts. Neither matters much for a
// read-only decode, but a sampler that disagreed with the encoder about
// threading or caching would be a puzzle nobody wants to debug later.
sharp.concurrency(1)
sharp.cache(false)

// ---------------------------------------------------------------------------
// The method (ADR-025) — every constant it depends on, in one place
// ---------------------------------------------------------------------------

/**
 * Fraction of the frame, per axis, that is sampled. 0.4 is ADR-025's number:
 * a centred 40% x 40% box is the part of a studio product shot that is
 * reliably the product itself rather than shadow, floor, or empty margin.
 */
const CENTRAL_FRACTION = 0.4

/**
 * Background test. Studio product photography in this category is shot on
 * white (or delivered with an alpha channel), so "background" means one of:
 *
 *   - effectively transparent, or
 *   - bright *and* near-neutral — high in every channel with little spread
 *     between them.
 *
 * Both halves are required. Brightness alone would eat a light grey or tan
 * fabric; neutrality alone would eat black and grey packs, which are most of
 * this catalog. Note there is deliberately no dark cutoff: a shadow is part of
 * the photograph, and discarding dark pixels would destroy the black colorways
 * the median is supposed to describe.
 */
const BACKGROUND_MIN_CHANNEL = 235
const BACKGROUND_MAX_SPREAD = 12
const BACKGROUND_MIN_ALPHA = 128

/**
 * If almost nothing survives the background test the crop was not on the
 * product, and the sample would describe noise. Better to fail loudly than to
 * emit a plausible-looking hex.
 */
const MIN_FOREGROUND_PIXELS = 64
const MIN_FOREGROUND_FRACTION = 0.02

/** Rec. 709 luma coefficients, applied to sRGB-encoded channel values. */
const LUMA_R = 0.2126
const LUMA_G = 0.7152
const LUMA_B = 0.0722

/**
 * Sort key packing. `luma * LUMA_SCALE` rounded to an integer is the primary
 * key and the 24-bit RGB triple is the tie-break, so two pixels of identical
 * luminance still have a strict, reproducible order. Max key is
 * 255 * 10000 * 2^24 ~= 4.3e13, comfortably inside Float64's exact integer
 * range, which is what lets the whole sample be one numeric TypedArray sort.
 */
const LUMA_SCALE = 10_000
const RGB_SPACE = 0x1000000

export type Swatch = {
  url: string
  hex: string
  /** Pixels in the central crop that survived the background test. */
  foreground: number
  /** Pixels in the central crop, before the background test. */
  sampled: number
  /** Intrinsic size of the source photograph, after EXIF orientation. */
  width: number
  height: number
}

function toHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

/**
 * The method itself, over already-decoded bytes. Separated from fetching and
 * caching so it can be reasoned about — and eventually unit-tested — without a
 * network or a filesystem.
 */
export async function sampleSwatchFromBytes(bytes: Buffer, label: string): Promise<Omit<Swatch, 'url'>> {
  // `.rotate()` before anything else, for the same reason process-images.ts
  // does it: EXIF orientation must be baked into pixels, or the "central" crop
  // is centred on a rotated frame and the sample is not reproducible from the
  // displayed image.
  const oriented = sharp(bytes).rotate()
  const meta = await oriented.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width < 1 || height < 1) throw new Error(`${label}: sharp could not read image dimensions`)

  // Integer crop arithmetic, rounded once. Anything float-derived here would
  // make the sample depend on how the rounding fell.
  const cropWidth = Math.max(1, Math.round(width * CENTRAL_FRACTION))
  const cropHeight = Math.max(1, Math.round(height * CENTRAL_FRACTION))
  const left = Math.floor((width - cropWidth) / 2)
  const top = Math.floor((height - cropHeight) / 2)

  // No resize: resampling would invent colours that are in no pixel of the
  // original, and the whole point is that the hex is a pixel the brand
  // published. `toColourspace('srgb')` normalises CMYK/greyscale sources so the
  // raw buffer is always 4 interleaved 8-bit channels.
  const { data } = await oriented
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const sampled = cropWidth * cropHeight
  const keys = new Float64Array(sampled)
  let kept = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const a = data[i + 3]!

    if (a < BACKGROUND_MIN_ALPHA) continue
    const min = r < g ? (r < b ? r : b) : g < b ? g : b
    const max = r > g ? (r > b ? r : b) : g > b ? g : b
    if (min >= BACKGROUND_MIN_CHANNEL && max - min <= BACKGROUND_MAX_SPREAD) continue

    const luma = LUMA_R * r + LUMA_G * g + LUMA_B * b
    keys[kept++] = Math.round(luma * LUMA_SCALE) * RGB_SPACE + ((r << 16) | (g << 8) | b)
  }

  if (kept < MIN_FOREGROUND_PIXELS || kept < sampled * MIN_FOREGROUND_FRACTION) {
    throw new Error(
      `${label}: only ${kept}/${sampled} pixels in the central ${Math.round(CENTRAL_FRACTION * 100)}% ` +
        'survived the background test — the crop is not on the product, so no hex was sampled',
    )
  }

  // TypedArray.sort is numeric and total, so this is the ordering the key
  // packing describes: luminance ascending, ties broken by r, then g, then b.
  const used = keys.subarray(0, kept)
  used.sort()

  // Lower median for an even count. Arbitrary but fixed — an averaged median
  // would emit a colour that is in no pixel of the photograph.
  const median = used[(kept - 1) >> 1]!
  const rgb = median % RGB_SPACE
  return {
    hex: toHex((rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff),
    foreground: kept,
    sampled,
    width,
    height,
  }
}

// ---------------------------------------------------------------------------
// Cache — never re-fetch what has already been downloaded (ADR-014)
// ---------------------------------------------------------------------------

type SwatchCacheEntry = { url: string; file: string; bytes: number; sha256: string; fetchedAt: string }
type SwatchCacheIndex = Record<string, SwatchCacheEntry>

const INDEX_PATH = resolve(SWATCH_CACHE_DIR, 'index.json')

/** Cache key is the URL, exactly as the per-pack manifest keys on the URL. */
function cacheKey(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

async function readIndex(): Promise<SwatchCacheIndex> {
  try {
    return JSON.parse(await readFile(INDEX_PATH, 'utf8')) as SwatchCacheIndex
  } catch {
    return {}
  }
}

async function writeIndex(index: SwatchCacheIndex): Promise<void> {
  // Key-sorted so the file does not churn on unrelated runs.
  const sorted: SwatchCacheIndex = {}
  for (const key of Object.keys(index).sort()) sorted[key] = index[key]!
  await writeFile(INDEX_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
}

/** Cached bytes if present, otherwise one throttled, robots-checked download. */
async function originalFor(url: string, quiet: boolean): Promise<Buffer> {
  await mkdir(SWATCH_CACHE_DIR, { recursive: true })
  const index = await readIndex()
  const key = cacheKey(url)
  const entry = index[key]

  if (entry) {
    try {
      const cached = await readFile(resolve(SWATCH_CACHE_DIR, entry.file))
      if (!quiet) log('cached', `${entry.file} (${cached.length} B) ${url}`)
      return cached
    } catch {
      // Index entry with no file on disk: fall through and re-download.
    }
  }

  const { bytes } = await fetchAsset(url)
  const meta = await sharp(bytes).metadata()
  if (!meta.format) throw new Error(`not a supported image (sharp read no format) — ${url}`)
  const file = `${key}.${meta.format}`
  await writeFile(resolve(SWATCH_CACHE_DIR, file), bytes)
  index[key] = {
    url,
    file,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    fetchedAt: new Date().toISOString(),
  }
  await writeIndex(index)
  if (!quiet) log('fetch', `${file} ${meta.width}x${meta.height} ${meta.format} ${bytes.length} B ${url}`)
  return bytes
}

export async function sampleSwatch(url: string, options: { quiet?: boolean } = {}): Promise<Swatch> {
  const bytes = await originalFor(url, options.quiet === true)
  return { url, ...(await sampleSwatchFromBytes(bytes, url)) }
}

// ---------------------------------------------------------------------------
// --check=<slug> — re-sample a committed capture and diff
// ---------------------------------------------------------------------------

/** Channel-wise distance, which is the number worth arguing about in a diff. */
function hexDelta(a: string, b: string): number {
  const parse = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16))
  const [ar, ag, ab] = parse(a) as [number, number, number]
  const [br, bg, bb] = parse(b) as [number, number, number]
  return Math.max(Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb))
}

type CheckRow = { name: string; recorded: string; sampled: string | null; delta: number | null; note: string }

async function checkCapture(slug: string, quiet: boolean): Promise<CheckRow[]> {
  const path = sourcePathFor(slug)
  const parsed = sourceSchema.safeParse(JSON.parse(await readFile(path, 'utf8')))
  if (!parsed.success) throw new Error(`${rel(path)} failed validation:\n${formatIssues(parsed.error)}`)

  const rows: CheckRow[] = []
  for (const colorway of parsed.data.colorways) {
    if (!colorway.swatchSource) {
      rows.push({
        name: colorway.name,
        recorded: colorway.hex,
        sampled: null,
        delta: null,
        note: 'no swatchSource — unsourced hex (ADR-025)',
      })
      continue
    }
    try {
      const swatch = await sampleSwatch(colorway.swatchSource, { quiet })
      rows.push({
        name: colorway.name,
        recorded: colorway.hex,
        sampled: swatch.hex,
        delta: hexDelta(colorway.hex, swatch.hex),
        note: `${swatch.foreground}/${swatch.sampled} px foreground`,
      })
    } catch (error) {
      // Per-colorway isolation: one unreachable photo must not abort the check.
      rows.push({ name: colorway.name, recorded: colorway.hex, sampled: null, delta: null, note: describeError(error) })
    }
  }
  return rows
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const checkArg = args.find((a: string) => a.startsWith('--check='))
  const urls = args.filter((a: string) => !a.startsWith('--'))

  // A mistyped flag must not look like a run that quietly did less — the same
  // rule ingest.ts enforces, for the same reason.
  const unrecognised = args.filter((a: string) => a.startsWith('--') && a !== '--json' && !a.startsWith('--check='))
  if (unrecognised.length > 0 || (urls.length === 0 && !checkArg)) {
    if (unrecognised.length > 0) log('fail', `unrecognised argument(s): ${unrecognised.join(', ')}`)
    log('fail', 'usage: pnpm sample-swatch [--json] <image-url>... | --check=<slug>')
    process.exit(1)
  }

  let failed = 0

  if (checkArg) {
    const slug = checkArg.slice('--check='.length)
    const rows = await checkCapture(slug, json)
    if (json) {
      process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`)
    } else {
      log.banner(`sample-swatch --check=${slug}`)
      for (const row of rows) {
        if (row.sampled === null) {
          log('warn', `${row.name}: recorded ${row.recorded}, not sampled — ${row.note}`)
          failed += 1
        } else {
          const verb = row.delta === 0 ? 'skip' : 'warn'
          log(verb, `${row.name}: recorded ${row.recorded} sampled ${row.sampled} delta ${row.delta} (${row.note})`)
        }
      }
      // Exit code deliberately tracks *unsourced*, not *unequal*. A nonzero
      // delta means the committed hex was produced by a different execution of
      // the method (GORUCK's thirteen were sampled by hand) — worth reading, not
      // worth failing a build over, and silently rewriting it to match would
      // destroy the evidence of which one is right. A missing swatchSource is
      // the thing ADR-025 actually calls incomplete.
      const sampled = rows.filter((r) => r.sampled !== null)
      const exact = sampled.filter((r) => r.delta === 0).length
      const worst = sampled.reduce((m, r) => Math.max(m, r.delta ?? 0), 0)
      log(
        'info',
        `${exact}/${sampled.length} reproduce exactly, worst channel delta ${worst}, ` +
          `${rows.length - sampled.length} not sampled`,
      )
    }
  }

  const swatches: Swatch[] = []
  for (const url of urls) {
    try {
      swatches.push(await sampleSwatch(url, { quiet: json }))
    } catch (error) {
      // Isolated per URL: sampling ten colorways must not lose nine to one 404.
      failed += 1
      log('fail', describeError(error))
    }
  }

  if (urls.length > 0) {
    if (json) {
      process.stdout.write(`${JSON.stringify(swatches, null, 2)}\n`)
    } else {
      log.banner('sampled')
      for (const s of swatches) log('info', `${s.hex}  ${s.foreground}/${s.sampled} px  ${s.url}`)
    }
  }

  if (!json) log('info', `${networkRequestCount()} network request(s) this run`)
  process.exit(failed > 0 ? 1 : 0)
}
