/**
 * Stage 1 — download at most 5 original product photos per pack into the
 * gitignored `.ingest-cache/{slug}/`.
 *
 * This is the only stage that touches the network, and it is written to touch
 * it as little as possible. **Never re-fetch what is already cached** (ADR-014):
 * the cache exists so image processing can be retuned without hitting a
 * retailer again, so re-downloading "because it is convenient" is a bug, not an
 * optimisation choice.
 *
 * A cached image is reused when the manifest records the *same URL* at the same
 * index and the file is still on disk. Changing one URL in
 * `data/sources/{slug}.json` therefore re-fetches exactly one image.
 *
 * Failures are per-pack and per-image. A blocked host, a 404, or a missing
 * source file degrades one pack; the run continues (ADR-014, CLAUDE.md).
 */
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { seedPacks } from '../data/seed.ts'
import { fetchAsset, networkRequestCount } from './lib/http.ts'
import { describeError, logger, type PackFailure } from './lib/log.ts'
import { cacheDirFor, manifestPathFor, rel, sourcePathFor } from './lib/paths.ts'
import { formatIssues, sourceSchema, type SourceCapture } from './lib/schema.ts'

const log = logger('fetch')

/** One cached original. `fetchedAt` is preserved across skips so it stays honest. */
export type CachedImage = {
  index: number
  url: string
  file: string
  format: string
  bytes: number
  sha256: string
  fetchedAt: string
}

export type CacheManifest = {
  slug: string
  images: CachedImage[]
}

/** sharp is the format oracle: a `Content-Type` header is a claim, the bytes are the fact. */
const FORMAT_EXTENSIONS: Record<string, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  gif: 'gif',
  tiff: 'tif',
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function readManifest(slug: string): Promise<CacheManifest | null> {
  try {
    return JSON.parse(await readFile(manifestPathFor(slug), 'utf8')) as CacheManifest
  } catch {
    return null
  }
}

export async function readSource(slug: string): Promise<SourceCapture> {
  const path = sourcePathFor(slug)
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    throw new Error(`no research capture at ${rel(path)} — see the Phase 5 brief`)
  }
  const parsed = sourceSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    throw new Error(`${rel(path)} failed validation:\n${formatIssues(parsed.error)}`)
  }
  if (parsed.data.slug !== slug) {
    throw new Error(`${rel(path)} declares slug "${parsed.data.slug}" but is filed under "${slug}"`)
  }
  return parsed.data
}

/** `access`, not `readFile`: these are multi-megabyte originals and we only want the yes/no. */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Remove cached files that no longer correspond to a manifest entry — an image
 * dropped from the source, or one whose format changed. Without this the cache
 * accumulates orphans that the next `process-images` run would happily encode.
 */
async function pruneCache(slug: string, keep: Set<string>): Promise<void> {
  const dir = cacheDirFor(slug)
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === 'manifest.json' || entry === 'processed.json' || keep.has(entry)) continue
    await rm(resolve(dir, entry), { force: true })
    log('prune', `${slug}/${entry} (no longer referenced)`)
  }
}

async function fetchPack(slug: string): Promise<CacheManifest> {
  const source = await readSource(slug)
  const dir = cacheDirFor(slug)
  await mkdir(dir, { recursive: true })

  const previous = await readManifest(slug)
  const previousByIndex = new Map((previous?.images ?? []).map((i) => [i.index, i]))

  const images: CachedImage[] = []
  const errors: string[] = []

  for (const [index, spec] of source.images.entries()) {
    const cached = previousByIndex.get(index)
    if (cached && cached.url === spec.url && (await fileExists(resolve(dir, cached.file)))) {
      log('cached', `${slug}[${index}] ${cached.file} (${cached.bytes} B)`)
      images.push(cached)
      continue
    }

    try {
      const { bytes } = await fetchAsset(spec.url)
      const meta = await sharp(bytes).metadata()
      const extension = FORMAT_EXTENSIONS[meta.format ?? '']
      if (!extension) {
        throw new Error(`not a supported image (sharp read format "${meta.format}")`)
      }
      const file = `${index}.${extension}`
      await writeFile(resolve(dir, file), bytes)
      log('fetch', `${slug}[${index}] ${meta.width}x${meta.height} ${meta.format} ${bytes.length} B`)
      images.push({
        index,
        url: spec.url,
        file,
        format: meta.format ?? extension,
        bytes: bytes.length,
        sha256: sha256(bytes),
        fetchedAt: new Date().toISOString(),
      })
    } catch (error) {
      // Isolated: the pack keeps whatever it already had, and the run goes on.
      const reason = describeError(error)
      errors.push(`image ${index}: ${reason}`)
      log('warn', `${slug}[${index}] ${reason}`)
      if (cached && (await fileExists(resolve(dir, cached.file)))) {
        log('cached', `${slug}[${index}] falling back to the cached copy`)
        images.push(cached)
      }
    }
  }

  if (images.length === 0) {
    throw new Error(`no images could be cached:\n  ${errors.join('\n  ')}`)
  }

  images.sort((a, b) => a.index - b.index)
  await pruneCache(slug, new Set(images.map((i) => i.file)))

  const manifest: CacheManifest = { slug, images }
  await writeFile(manifestPathFor(slug), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return manifest
}

export type FetchResult = {
  manifests: Map<string, CacheManifest>
  failures: PackFailure[]
}

export async function fetchImages(slugs: string[]): Promise<FetchResult> {
  log.banner('fetch-images')
  const manifests = new Map<string, CacheManifest>()
  const failures: PackFailure[] = []

  for (const slug of slugs) {
    try {
      manifests.set(slug, await fetchPack(slug))
    } catch (error) {
      failures.push({ slug, stage: 'fetch-images', reason: describeError(error) })
      log('fail', `${slug}: ${describeError(error)}`)
    }
  }

  log('info', `${manifests.size} pack(s) cached, ${networkRequestCount()} network request(s) made`)
  return { manifests, failures }
}

// Runnable on its own: `node --experimental-strip-types scripts/fetch-images.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { failures } = await fetchImages(seedPacks.map((p) => p.slug))
  process.exit(failures.length > 0 ? 1 : 0)
}
