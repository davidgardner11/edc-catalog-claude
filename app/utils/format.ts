/**
 * Display formatting for catalog numbers. Pure and side-effect free so the
 * card components stay declarative and every rule here is unit-testable
 * (Phase 7). Nothing in this module reads Vue state.
 */

// Built once: constructing an Intl.NumberFormat per render is measurably slow
// on a 20-card grid.
const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const centsDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * `249` -> `"$249"`, `249.5` -> `"$249.50"`.
 *
 * Trailing `.00` is dropped because every price in the catalog so far is whole
 * dollars and `$249.00` reads as noise at `text-sm` in band 3. Rounding to
 * cents first means a float artifact (`248.99999999`) is treated as whole
 * rather than rendering `$249.00`.
 */
export function formatPrice(amountUsd: number): string {
  if (!Number.isFinite(amountUsd)) return ''
  const cents = Math.round(amountUsd * 100)
  return cents % 100 === 0 ? wholeDollars.format(cents / 100) : centsDollars.format(cents / 100)
}

/**
 * `4.4, 5` -> `"4.4/5.0"`, `9.2, 10` -> `"9.2/10.0"`.
 *
 * Both sides are always shown to one decimal: the scale is NOT implied, because
 * it differs per pack (ADR-010). `8.1` alone is ambiguous between the two
 * scales; `8.1/10.0` is not.
 */
export function formatScore(score: number, scale: number): string {
  return `${score.toFixed(1)}/${scale.toFixed(1)}`
}

/**
 * `score / scale` clamped to 0-1. **This — not `score` — is what sorting and
 * filtering must use** (ADR-010): a 4.4/5.0 pack (0.88) outranks a 9.2/10.0
 * pack (0.92) only if you forget to normalize.
 *
 * Display never uses this; it uses `formatScore`.
 */
export function normalizeScore(score: number, scale: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(scale) || scale <= 0) return 0
  return Math.min(1, Math.max(0, score / scale))
}

/**
 * Screen-reader text for a score. `"4.4/5.0"` is announced as "4.4 slash 5.0"
 * or "4.4 fraction 5.0" depending on the reader, so the visible text is
 * `aria-hidden` and this sentence is exposed instead.
 */
export function scoreSpokenLabel(score: number, scale: number, source: string): string {
  return `Rated ${score.toFixed(1)} out of ${scale.toFixed(1)} by ${source}`
}
