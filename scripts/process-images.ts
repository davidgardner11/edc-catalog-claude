/**
 * Stage 2 — sharp encodes each cached original into
 * `public/images/{slug}/{n}-{w}.{avif,webp}` for w in {640, 1280} (ADR-005).
 *
 * Reads only from `.ingest-cache/`. Deleting `public/images/` and re-running
 * must rebuild everything without a single network request; that is the second
 * half of the Phase 4 gate, and it is why this stage never sees a URL.
 *
 * **Determinism.** `pnpm ingest` on unchanged inputs must be byte-identical
 * (ADR-014), and image encoders are the usual place that guarantee dies:
 *
 *   - `sharp.concurrency(1)` — libaom's tile/row threading can vary bit output
 *     between runs. One thread removes the whole question. It costs wall time,
 *     not correctness.
 *   - `sharp.cache(false)` — no cross-run operation cache to make run 2 differ
 *     from run 1.
 *   - metadata is dropped (sharp's default; `withMetadata()` is never called),
 *     so no capture timestamp or ICC payload leaks into the output.
 *   - `.rotate()` before `.resize()` bakes EXIF orientation into pixels, so
 *     stripping metadata cannot flip an image.
 *   - every encoder parameter is pinned below, including `kernel`, which is a
 *     sharp default today and could stop being one.
 *
 * **Idempotency.** `.ingest-cache/{slug}/processed.json` stamps each output
 * with the source SHA, the encoder identity, and the SHA of the bytes written.
 * A re-run re-encodes only when a stamp is missing, stale, or an output file is
 * gone or altered. `INGEST_REENCODE=1` ignores the stamps entirely — that is
 * the switch that *proves* the encoder is deterministic rather than assuming it.
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { seedPacks } from '../data/seed.ts'
import { describeError, logger, type PackFailure } from './lib/log.ts'
import { readManifest, type CacheManifest } from './fetch-images.ts'
import { cacheDirFor, outputDirFor, rel, stampPathFor } from './lib/paths.ts'
import { IMAGE_WIDTHS } from './lib/schema.ts'

const log = logger('images')

sharp.concurrency(1)
sharp.cache(false)

const FORMATS = ['avif', 'webp'] as const
type OutputFormat = (typeof FORMATS)[number]

/**
 * Pinned encoder settings. Any change here must change ENCODER_ID too, or
 * stamped outputs from the old settings survive a re-run and the catalog ends
 * up with two generations of encoding side by side.
 */
const AVIF_OPTIONS = { quality: 50, effort: 4, chromaSubsampling: '4:4:4' } as const
const WEBP_OPTIONS = { quality: 80, effort: 4, smartSubsample: true } as const
const RESIZE_OPTIONS = {
  fit: 'inside',
  kernel: 'lanczos3',
  // Deliberately enlarging: `widths` is pinned to [640, 1280] in the schema, so
  // an output narrower than its declared width would make every srcset in the
  // catalog a lie. Sources below 1280w are upscaled and warned about instead.
  withoutEnlargement: false,
} as const

/** Identity of the encoder *and* its settings — the stamp's invalidation key. */
const ENCODER_ID = [
  `sharp@${sharp.versions.sharp}`,
  `vips@${sharp.versions.vips}`,
  `avif=${JSON.stringify(AVIF_OPTIONS)}`,
  `webp=${JSON.stringify(WEBP_OPTIONS)}`,
  `resize=${JSON.stringify(RESIZE_OPTIONS)}`,
  `widths=${IMAGE_WIDTHS.join(',')}`,
].join(' ')

/**
 * Whether to ignore the encode stamps and re-encode everything.
 *
 * Passed in as an argument rather than read from module scope. A module-level
 * `const ... = process.env.X === '1'` is evaluated when this module is
 * *imported*, which for a static `import` is strictly before the importing
 * module's body runs — so a caller that sets the variable and then calls in
 * has no effect at all, silently. That was a real bug here: `--reencode`
 * looked like it worked and re-encoded nothing.
 *
 * The env var is still supported, but it is read at call time and only as the
 * default, so there is exactly one place the decision is made and no way to
 * make it too late.
 */
export function reencodeRequestedByEnv(): boolean {
  return process.env.INGEST_REENCODE === '1'
}

export type ProcessOptions = {
  /** Defaults to `reencodeRequestedByEnv()`, evaluated when `processImages` is called. */
  reencode?: boolean
}

/** What one source image produced. `width`/`height` are the LARGEST variant's. */
export type ProcessedImage = {
  index: number
  sourceSha256: string
  width: number
  height: number
  upscaled: boolean
  /** filename -> sha256 of the bytes on disk. */
  outputs: Record<string, string>
}

export type ProcessStamp = {
  slug: string
  encoder: string
  images: ProcessedImage[]
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function outputName(index: number, width: number, format: OutputFormat): string {
  return `${index}-${width}.${format}`
}

async function readStamp(slug: string): Promise<ProcessStamp | null> {
  try {
    return JSON.parse(await readFile(stampPathFor(slug), 'utf8')) as ProcessStamp
  } catch {
    return null
  }
}

/** A stamp is only trusted if every file it claims exists with the recorded bytes. */
async function stampHolds(slug: string, entry: ProcessedImage): Promise<boolean> {
  const dir = outputDirFor(slug)
  for (const [name, expected] of Object.entries(entry.outputs)) {
    try {
      if (sha256(await readFile(resolve(dir, name))) !== expected) return false
    } catch {
      return false
    }
  }
  return true
}

async function encodeOne(
  slug: string,
  source: Buffer,
  index: number,
): Promise<ProcessedImage> {
  const dir = outputDirFor(slug)
  const original = await sharp(source).metadata()
  const largest = Math.max(...IMAGE_WIDTHS)
  const upscaled = (original.width ?? 0) < largest

  const outputs: Record<string, string> = {}
  let width = 0
  let height = 0

  for (const targetWidth of IMAGE_WIDTHS) {
    for (const format of FORMATS) {
      // Re-derived from the original bytes each time: a sharp pipeline is
      // single-use, and reusing one silently applies operations twice.
      const pipeline = sharp(source)
        .rotate()
        .resize({ width: targetWidth, ...RESIZE_OPTIONS })
      const encoded =
        format === 'avif'
          ? await pipeline.avif(AVIF_OPTIONS).toBuffer({ resolveWithObject: true })
          : await pipeline.webp(WEBP_OPTIONS).toBuffer({ resolveWithObject: true })

      const name = outputName(index, targetWidth, format)
      const path = resolve(dir, name)

      // Write only when the bytes differ. Identical content keeps its mtime,
      // so a no-op run leaves the working tree untouched in every observable way.
      let unchanged = false
      try {
        unchanged = Buffer.compare(await readFile(path), encoded.data) === 0
      } catch {
        unchanged = false
      }
      if (!unchanged) await writeFile(path, encoded.data)

      outputs[name] = sha256(encoded.data)
      if (targetWidth === largest && format === 'webp') {
        width = encoded.info.width
        height = encoded.info.height
      }
    }
  }

  return { index, sourceSha256: sha256(source), width, height, upscaled, outputs }
}

/** Delete emitted files no longer claimed by the stamp (image count went down). */
async function pruneOutputs(slug: string, keep: Set<string>): Promise<void> {
  const dir = outputDirFor(slug)
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (keep.has(entry)) continue
    await rm(resolve(dir, entry), { force: true })
    log('prune', `${rel(resolve(dir, entry))} (no longer emitted)`)
  }
}

async function processPack(manifest: CacheManifest, reencode: boolean): Promise<ProcessStamp> {
  const { slug } = manifest
  await mkdir(outputDirFor(slug), { recursive: true })

  const previous = await readStamp(slug)
  const reusable =
    previous !== null && previous.encoder === ENCODER_ID && !reencode
      ? new Map(previous.images.map((i) => [i.index, i]))
      : new Map<number, ProcessedImage>()

  const images: ProcessedImage[] = []
  for (const cached of manifest.images) {
    const stamped = reusable.get(cached.index)
    if (stamped && stamped.sourceSha256 === cached.sha256 && (await stampHolds(slug, stamped))) {
      log('skip', `${slug}[${cached.index}] up to date (${Object.keys(stamped.outputs).length} files)`)
      images.push(stamped)
      continue
    }

    const source = await readFile(resolve(cacheDirFor(slug), cached.file))
    const processed = await encodeOne(slug, source, cached.index)
    if (processed.upscaled) {
      log(
        'warn',
        `${slug}[${cached.index}] source is narrower than ${Math.max(...IMAGE_WIDTHS)}w — `
          + `upscaled so widths ${IMAGE_WIDTHS.join('/')} stay true`,
      )
    }
    log(
      'encode',
      `${slug}[${cached.index}] -> ${Object.keys(processed.outputs).length} files, `
        + `intrinsic ${processed.width}x${processed.height}`,
    )
    images.push(processed)
  }

  images.sort((a, b) => a.index - b.index)
  await pruneOutputs(slug, new Set(images.flatMap((i) => Object.keys(i.outputs))))

  const stamp: ProcessStamp = { slug, encoder: ENCODER_ID, images }
  await writeFile(stampPathFor(slug), `${JSON.stringify(stamp, null, 2)}\n`, 'utf8')
  return stamp
}

export type ProcessResult = {
  stamps: Map<string, ProcessStamp>
  failures: PackFailure[]
}

export async function processImages(
  slugs: string[],
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const reencode = options.reencode ?? reencodeRequestedByEnv()
  log.banner(`process-images${reencode ? ' (forced re-encode)' : ''}`)
  const stamps = new Map<string, ProcessStamp>()
  const failures: PackFailure[] = []

  for (const slug of slugs) {
    try {
      const manifest = await readManifest(slug)
      if (!manifest) throw new Error(`nothing cached in ${rel(cacheDirFor(slug))} — run fetch-images first`)
      stamps.set(slug, await processPack(manifest, reencode))
    } catch (error) {
      failures.push({ slug, stage: 'process-images', reason: describeError(error) })
      log('fail', `${slug}: ${describeError(error)}`)
    }
  }
  return { stamps, failures }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { failures } = await processImages(seedPacks.map((p) => p.slug))
  process.exit(failures.length > 0 ? 1 : 0)
}
