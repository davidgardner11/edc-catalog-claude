/**
 * Every path the ingest pipeline touches, resolved from this file's own
 * location rather than `process.cwd()`.
 *
 * Why: the scripts are runnable three ways — `pnpm ingest`, `node
 * scripts/build-catalog.ts` from the repo root, and from an editor's run
 * button in an arbitrary cwd. Anchoring to `import.meta.url` makes all three
 * identical, which is a precondition for the byte-identical-output guarantee
 * (ADR-014): a cwd-relative path would silently write the catalog somewhere
 * else instead of failing.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

/** Repository root — `scripts/lib/` is two levels down. */
export const REPO_ROOT: string = resolve(HERE, '..', '..')

/** Hand-authored inputs. Edit these, never the outputs (ADR-014). */
export const DATA_DIR: string = resolve(REPO_ROOT, 'data')
export const SOURCES_DIR: string = resolve(DATA_DIR, 'sources')
export const SEED_PATH: string = resolve(DATA_DIR, 'seed.ts')

/**
 * Gitignored originals + per-stage bookkeeping. This directory is the whole
 * reason image processing can be retuned without re-hitting a retailer
 * (ADR-009, ADR-014). Deleting it is the only thing that forces a re-download.
 */
export const CACHE_DIR: string = resolve(REPO_ROOT, '.ingest-cache')
export const ROBOTS_CACHE_DIR: string = resolve(CACHE_DIR, '.robots')

/** Generated outputs. Never hand-edited; both are gitignored (ADR-012). */
export const PUBLIC_IMAGES_DIR: string = resolve(REPO_ROOT, 'public', 'images')
export const CATALOG_PATH: string = resolve(REPO_ROOT, 'app', 'data', 'catalog.json')

/** `.ingest-cache/{slug}/` — downloaded originals for one pack. */
export function cacheDirFor(slug: string): string {
  return resolve(CACHE_DIR, slug)
}

/** `.ingest-cache/{slug}/manifest.json` — what was downloaded, and from where. */
export function manifestPathFor(slug: string): string {
  return resolve(cacheDirFor(slug), 'manifest.json')
}

/**
 * `.ingest-cache/{slug}/processed.json` — the encode stamp.
 *
 * Deliberately *not* under `public/images/{slug}/`: everything in `public/` is
 * copied verbatim into the static build, and a bookkeeping file has no
 * business shipping to browsers.
 */
export function stampPathFor(slug: string): string {
  return resolve(cacheDirFor(slug), 'processed.json')
}

/** `public/images/{slug}/` — emitted AVIF/WebP variants for one pack. */
export function outputDirFor(slug: string): string {
  return resolve(PUBLIC_IMAGES_DIR, slug)
}

/** `data/sources/{slug}.json` — the research capture for one pack. */
export function sourcePathFor(slug: string): string {
  return resolve(SOURCES_DIR, `${slug}.json`)
}

/** Repo-relative form, for log lines that should not leak an absolute path. */
export function rel(absolute: string): string {
  return absolute.startsWith(REPO_ROOT) ? absolute.slice(REPO_ROOT.length + 1) : absolute
}
