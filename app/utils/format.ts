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

/**
 * `24` -> `"24 L"`, `24.3` -> `"24.3 L"`.
 *
 * Trailing `.0` is dropped for the same reason `formatPrice` drops `.00`: most
 * capacities are whole litres and `24.0 L` reads as false precision. Capacity is
 * verified for 17 of the 19 ranks (ADR-023, ADR-033), so this is only ever
 * called behind a presence check.
 */
export function formatCapacity(liters: number): string {
  if (!Number.isFinite(liters)) return ''
  const rounded = Math.round(liters * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} L`
}

/**
 * `1406` -> `"1,406 g (3.1 lb)"`.
 *
 * Both units, because the catalog is US-priced but the brands publish specs in
 * whichever unit they prefer; grams is what the data stores, so grams leads.
 */
export function formatWeight(grams: number): string {
  if (!Number.isFinite(grams)) return ''
  const pounds = grams / 453.59237
  return `${Math.round(grams).toLocaleString('en-US')} g (${pounds.toFixed(1)} lb)`
}

/**
 * `"2026-09-03T00:00:00Z"` -> `"Sep 3, 2026"`.
 *
 * `timeZone: 'UTC'` is load-bearing, not cosmetic: without it the prerendered
 * HTML is formatted in the build machine's zone and the browser reformats in the
 * visitor's, which is a hydration mismatch on any date near midnight. There is
 * no server at runtime to re-render it away.
 *
 * Prices and scores are point-in-time snapshots and the UI must never imply they
 * are live (ADR-009) — this is what makes the capture date visible.
 */
const capturedDate = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatCapturedDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  return Number.isNaN(parsed.getTime()) ? '' : capturedDate.format(parsed)
}
