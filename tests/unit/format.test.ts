import { describe, expect, it } from 'vitest'
import { formatPrice, formatScore, normalizeScore, scoreSpokenLabel } from '../../app/utils/format'

/**
 * `app/utils/format.ts` — display formatting and the normalized sort key.
 *
 * The load-bearing case here is ADR-010: two review scales coexist, display
 * shows the raw pair, and sorting/filtering must use `score / scale`. The
 * `sorts by ratio` block below fails loudly if anyone sorts on `score`.
 *
 * Imports are relative rather than `~/utils/...` because these tests run
 * outside the Nuxt app context, where the `~` alias is not configured.
 */

describe('formatPrice', () => {
  it('drops a trailing .00 on whole dollars', () => {
    expect(formatPrice(249)).toBe('$249')
    expect(formatPrice(139)).toBe('$139')
    expect(formatPrice(0)).toBe('$0')
  })

  it('keeps cents when there are any', () => {
    expect(formatPrice(249.5)).toBe('$249.50')
    expect(formatPrice(139.99)).toBe('$139.99')
  })

  it('groups thousands', () => {
    expect(formatPrice(1299)).toBe('$1,299')
  })

  it('treats a float artifact as whole dollars rather than rendering $249.00', () => {
    expect(formatPrice(248.99999999)).toBe('$249')
  })

  it('rounds to the nearest cent', () => {
    expect(formatPrice(99.994)).toBe('$99.99')
    expect(formatPrice(99.996)).toBe('$100')
  })

  it('returns empty string for non-finite input rather than "$NaN"', () => {
    expect(formatPrice(Number.NaN)).toBe('')
    expect(formatPrice(Number.POSITIVE_INFINITY)).toBe('')
  })
})

describe('formatScore', () => {
  // ADR-010: the scale is never implied, because it differs per pack.
  it('renders both scales with the divisor visible', () => {
    expect(formatScore(4.4, 5)).toBe('4.4/5.0')
    expect(formatScore(8.1, 10)).toBe('8.1/10.0')
  })

  it('pads whole numbers to one decimal on both sides', () => {
    expect(formatScore(5, 5)).toBe('5.0/5.0')
    expect(formatScore(9, 10)).toBe('9.0/10.0')
  })

  it('rounds to one decimal', () => {
    expect(formatScore(4.44, 5)).toBe('4.4/5.0')
    expect(formatScore(4.45, 5)).toBe('4.5/5.0')
  })

  // The same assertion the E2E suite makes against rendered text.
  it.each([
    [4.4, 5],
    [8.1, 10],
    [9.2, 10],
    [4.7, 5],
  ])('formatScore(%f, %f) matches the rendered-score pattern', (score, scale) => {
    expect(formatScore(score, scale)).toMatch(/^\d+\.\d\/\d+\.\d$/)
  })
})

describe('normalizeScore', () => {
  it('is score / scale on both scales', () => {
    expect(normalizeScore(4.4, 5)).toBeCloseTo(0.88, 10)
    expect(normalizeScore(8.1, 10)).toBeCloseTo(0.81, 10)
  })

  it('rates equal scores on different scales as equal', () => {
    expect(normalizeScore(4.4, 5)).toBe(normalizeScore(8.8, 10))
    expect(normalizeScore(4.6, 5)).toBe(normalizeScore(9.2, 10))
  })

  it('stays within 0-1', () => {
    expect(normalizeScore(5, 5)).toBe(1)
    expect(normalizeScore(0, 5)).toBe(0)
    // Out-of-range data clamps rather than producing a >1 sort key.
    expect(normalizeScore(11, 10)).toBe(1)
    expect(normalizeScore(-2, 5)).toBe(0)
  })

  it('returns 0 for unusable input instead of NaN or Infinity', () => {
    expect(normalizeScore(4.4, 0)).toBe(0)
    expect(normalizeScore(4.4, -5)).toBe(0)
    expect(normalizeScore(Number.NaN, 5)).toBe(0)
    expect(normalizeScore(4.4, Number.NaN)).toBe(0)
  })

  describe('sorts by ratio, not by raw score (ADR-010)', () => {
    const packs = [
      { slug: 'five-scale-high', score: 4.6, scale: 5 }, // 0.92
      { slug: 'ten-scale-mid', score: 8.1, scale: 10 }, // 0.81
      { slug: 'five-scale-mid', score: 4.4, scale: 5 }, // 0.88
      { slug: 'ten-scale-high', score: 9.5, scale: 10 }, // 0.95
    ]

    const byNormalized = [...packs]
      .sort((a, b) => normalizeScore(b.score, b.scale) - normalizeScore(a.score, a.scale))
      .map((p) => p.slug)

    it('ranks a 8.1/10.0 pack below a 4.6/5.0 pack', () => {
      expect(byNormalized).toEqual([
        'ten-scale-high',
        'five-scale-high',
        'five-scale-mid',
        'ten-scale-mid',
      ])
    })

    it('produces a different order than sorting on the raw score would', () => {
      const byRawScore = [...packs].sort((a, b) => b.score - a.score).map((p) => p.slug)
      expect(byRawScore).not.toEqual(byNormalized)
    })
  })
})

describe('scoreSpokenLabel', () => {
  it('spells out the fraction so a reader does not say "slash"', () => {
    expect(scoreSpokenLabel(4.4, 5, 'REI')).toBe('Rated 4.4 out of 5.0 by REI')
    expect(scoreSpokenLabel(9.2, 10, 'Carryology')).toBe('Rated 9.2 out of 10.0 by Carryology')
  })

  it('uses the same one-decimal rounding as the visible text', () => {
    expect(scoreSpokenLabel(5, 5, 'REI')).toContain('5.0 out of 5.0')
  })
})
