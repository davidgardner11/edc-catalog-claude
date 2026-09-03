/**
 * Cyclic index arithmetic for the card's two wrapping controls: the image
 * carousel and the colorway pager (ADR-016). Modulo, never bounds-clamping —
 * no control on a card is ever rendered disabled.
 *
 * Lives here rather than inside the SFCs because this is where the real bugs
 * are (n = 1, n = 0, the partial final page) and it is the part Phase 7 unit
 * tests exercise directly.
 */

/** The colorway grid is rigidly 4 columns x 2 rows (ADR-015). */
export const COLORWAY_CELLS = 8

/** Above 8 colorways cell 8 becomes the pager, leaving 7 for colorways. */
export const COLORWAY_PER_PAGE = COLORWAY_CELLS - 1

/**
 * True modulo: `wrapIndex(-1, 5) === 4`. JS `%` keeps the sign of the dividend,
 * so `-1 % 5` is `-1` and a naive `i % n` silently produces an invalid index.
 */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return ((index % length) + length) % length
}

/** Next index, wrapping last -> first. `n === 1` returns 0 (the same image). */
export function nextIndex(index: number, length: number): number {
  return wrapIndex(index + 1, length)
}

/** Previous index, wrapping first -> last. `n === 1` returns 0. */
export function prevIndex(index: number, length: number): number {
  return wrapIndex(index - 1, length)
}

/**
 * The indices a carousel should have loaded around `index`: the current image
 * and both neighbors. Deduplicated, so n = 1 yields `[0]` and n = 2 yields two
 * entries rather than three.
 */
export function neighborIndices(index: number, length: number): number[] {
  if (length <= 0) return []
  return [...new Set([wrapIndex(index, length), prevIndex(index, length), nextIndex(index, length)])]
}

/**
 * Page count for a colorway list. At or below 8 there is no pager and therefore
 * exactly one page; above 8, cell 8 costs one colorway per page, so it is
 * `ceil(n / 7)` and not `ceil(n / 8)`.
 */
export function colorwayPageCount(count: number): number {
  if (count <= COLORWAY_CELLS) return 1
  return Math.ceil(count / COLORWAY_PER_PAGE)
}

/**
 * Everything ColorwayGrid needs to render one page, so the SFC contains no
 * arithmetic. `items.length + ghostCells + (hasPager ? 1 : 0)` is always
 * exactly `COLORWAY_CELLS` — that identity is the geometry invariant (ADR-015)
 * and is what makes every card the same shape.
 */
export type ColorwayPage<T> = {
  items: T[]
  /** Dashed placeholder cells padding the page out to 8. */
  ghostCells: number
  /** Whether cell 8 is the `>` pager. False at 8 colorways or fewer. */
  hasPager: boolean
  /** Normalized page index — safe even if the caller passes out of range. */
  page: number
  pageCount: number
}

export function colorwayPage<T>(colorways: readonly T[], page: number): ColorwayPage<T> {
  const count = colorways.length
  const pageCount = colorwayPageCount(count)
  const hasPager = count > COLORWAY_CELLS
  const safePage = wrapIndex(page, pageCount)

  const items = hasPager
    ? colorways.slice(safePage * COLORWAY_PER_PAGE, safePage * COLORWAY_PER_PAGE + COLORWAY_PER_PAGE)
    : colorways.slice(0, COLORWAY_CELLS)

  return {
    items: [...items],
    // The pager occupies cell 8 on EVERY page, including a partial final one,
    // so ghost padding fills the gap between the page's colorways and it.
    ghostCells: COLORWAY_CELLS - items.length - (hasPager ? 1 : 0),
    hasPager,
    page: safePage,
    pageCount,
  }
}
