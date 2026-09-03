/**
 * Reads `.ingest-cache/{slug}/processed.json` without re-running the encoder.
 *
 * Exists so `scripts/build-catalog.ts` can be run on its own — the common loop
 * when you are changing the catalog's *shape* rather than its images, and the
 * one case where paying for an AVIF re-encode would be pure waste.
 */
import { readFile } from 'node:fs/promises'
import { stampPathFor } from './paths.ts'
import type { ProcessStamp } from '../process-images.ts'

export async function readStampsForSlugs(slugs: string[]): Promise<Map<string, ProcessStamp>> {
  const stamps = new Map<string, ProcessStamp>()
  for (const slug of slugs) {
    try {
      stamps.set(slug, JSON.parse(await readFile(stampPathFor(slug), 'utf8')) as ProcessStamp)
    } catch {
      // Absent stamp == pack not processed yet. buildCatalog reports it.
    }
  }
  return stamps
}
