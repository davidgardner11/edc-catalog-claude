import { describe, expect, it } from 'vitest'
import type { CarouselImage } from '../../app/types/backpack'
import { CARD_IMAGE_SIZES, buildSrcSet, fallbackSrc } from '../../app/utils/image'
import { fixtureBackpacks } from '../../app/data/fixtures'

/**
 * `app/utils/image.ts` — the one place the ingest filename shape
 * (`{base}-{w}.{avif,webp}`, ADR-005) is spelled out on the frontend. If these
 * assertions and `scripts/ingest.ts` ever disagree, every image 404s.
 */

const image = (overrides: Partial<CarouselImage> = {}): CarouselImage => ({
  base: '/images/aer-travel-pack-3/2',
  widths: [640, 1280],
  width: 1280,
  height: 1280,
  alt: 'Aer Travel Pack 3 — view 3 of 5',
  ...overrides,
})

describe('buildSrcSet', () => {
  it('emits `${base}-${w}.${format} ${w}w` per width, comma separated', () => {
    expect(buildSrcSet(image(), 'avif')).toBe(
      '/images/aer-travel-pack-3/2-640.avif 640w, /images/aer-travel-pack-3/2-1280.avif 1280w',
    )
    expect(buildSrcSet(image(), 'webp')).toBe(
      '/images/aer-travel-pack-3/2-640.webp 640w, /images/aer-travel-pack-3/2-1280.webp 1280w',
    )
  })

  it('orders by ascending width whatever order widths arrives in', () => {
    expect(buildSrcSet(image({ widths: [1280, 640] }), 'avif')).toBe(
      buildSrcSet(image({ widths: [640, 1280] }), 'avif'),
    )
  })

  it('leaves the source widths array untouched', () => {
    const widths = [1280, 640]
    const subject = image({ widths })
    buildSrcSet(subject, 'avif')
    // Catalog data is a shared build-time import; sorting it in place would
    // mutate it for every other consumer.
    expect(widths).toEqual([1280, 640])
  })

  it('emits a single entry with no separator for one width', () => {
    expect(buildSrcSet(image({ widths: [640] }), 'webp')).toBe(
      '/images/aer-travel-pack-3/2-640.webp 640w',
    )
  })

  it('is empty when there are no widths', () => {
    expect(buildSrcSet(image({ widths: [] }), 'webp')).toBe('')
  })
})

describe('fallbackSrc', () => {
  it('defaults to the widest WebP — the format every browser supports', () => {
    expect(fallbackSrc(image())).toBe('/images/aer-travel-pack-3/2-1280.webp')
  })

  it('honours an explicit format', () => {
    expect(fallbackSrc(image(), 'avif')).toBe('/images/aer-travel-pack-3/2-1280.avif')
  })

  it('picks the largest width regardless of array order', () => {
    expect(fallbackSrc(image({ widths: [1280, 640] }))).toBe(
      '/images/aer-travel-pack-3/2-1280.webp',
    )
  })

  it('falls back to the intrinsic width rather than emitting -Infinity', () => {
    const src = fallbackSrc(image({ widths: [], width: 1280 }))
    expect(src).toBe('/images/aer-travel-pack-3/2-1280.webp')
    expect(src).not.toContain('Infinity')
  })
})

describe('CARD_IMAGE_SIZES', () => {
  // ADR-021 pins the card to 260-320px, so a fixed `sizes` is honest and a 2x
  // screen picks the 640w variant.
  it('is the card’s real maximum width, not a viewport guess', () => {
    expect(CARD_IMAGE_SIZES).toBe('320px')
  })
})

describe('fixture images build usable URLs', () => {
  const images = fixtureBackpacks.flatMap((pack) =>
    pack.images.map((img, i) => [pack.slug, i, img] as const),
  )

  it.each(images)('%s image %i', (_slug, _i, img) => {
    for (const format of ['avif', 'webp'] as const) {
      const entries = buildSrcSet(img, format).split(', ')
      expect(entries).toHaveLength(img.widths.length)
      entries.forEach((entry, k) => {
        const w = [...img.widths].sort((a, b) => a - b)[k]
        expect(entry).toBe(`${img.base}-${w}.${format} ${w}w`)
      })
    }
    expect(fallbackSrc(img)).toBe(`${img.base}-${img.width}.webp`)
  })
})
