import { describe, expect, it } from 'vitest'
import {
  COLORWAY_CELLS,
  COLORWAY_PER_PAGE,
  colorwayPage,
  colorwayPageCount,
  neighborIndices,
  nextIndex,
  prevIndex,
  wrapIndex,
} from '../../app/utils/cycle'

/**
 * `app/utils/cycle.ts` — the two wrapping controls on a card.
 *
 * Two invariants are pinned here and nothing else in the codebase can pin them:
 *
 * - ADR-016: everything cyclable wraps by modulo. There is no index at which a
 *   control would be disabled, and `n = 1` is the case a naive `i % n` or a
 *   bounds-clamp gets wrong.
 * - ADR-015: `items.length + ghostCells + (hasPager ? 1 : 0) === 8` on every
 *   page of every colorway count, and the pager is always the 8th cell.
 */

/** Colorway stand-ins; `colorwayPage` is generic and never reads the element. */
const swatches = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`)

/** 0 through 25 covers 0/4/8/9/15/22 from the plan plus every count between. */
const COUNTS = Array.from({ length: 26 }, (_, n) => n)

describe('COLORWAY constants', () => {
  it('is a rigid 4x2 grid with 7 colorways per page once the pager appears', () => {
    expect(COLORWAY_CELLS).toBe(8)
    expect(COLORWAY_PER_PAGE).toBe(7)
  })
})

describe('wrapIndex', () => {
  it.each([
    [0, 5, 0],
    [4, 5, 4],
    [5, 5, 0],
    [6, 5, 1],
    [12, 5, 2],
    // JS `%` keeps the sign of the dividend; -1 % 5 is -1, which is not an index.
    [-1, 5, 4],
    [-5, 5, 0],
    [-6, 5, 4],
    [-13, 5, 2],
    [0, 1, 0],
    [3, 1, 0],
    [-3, 1, 0],
  ])('wrapIndex(%i, %i) === %i', (index, length, expected) => {
    expect(wrapIndex(index, length)).toBe(expected)
  })

  it('returns 0 rather than NaN for an empty or invalid length', () => {
    expect(wrapIndex(0, 0)).toBe(0)
    expect(wrapIndex(3, 0)).toBe(0)
    expect(wrapIndex(3, -2)).toBe(0)
  })
})

describe('nextIndex / prevIndex', () => {
  it('wraps at n = 5 in both directions', () => {
    expect(nextIndex(0, 5)).toBe(1)
    expect(nextIndex(4, 5)).toBe(0)
    expect(prevIndex(4, 5)).toBe(3)
    expect(prevIndex(0, 5)).toBe(4)
  })

  // The single-image pack: both controls stay live and land back on the image.
  it('resolves to the same index at n = 1', () => {
    expect(nextIndex(0, 1)).toBe(0)
    expect(prevIndex(0, 1)).toBe(0)
  })

  it.each([1, 2, 3, 5, 8])('never leaves 0..n-1 at n = %i', (n) => {
    for (let i = 0; i < n; i++) {
      expect(nextIndex(i, n)).toBeGreaterThanOrEqual(0)
      expect(nextIndex(i, n)).toBeLessThan(n)
      expect(prevIndex(i, n)).toBeGreaterThanOrEqual(0)
      expect(prevIndex(i, n)).toBeLessThan(n)
    }
  })

  it.each([1, 2, 3, 5, 8])('is a full cycle at n = %i — no index dead-ends', (n) => {
    const visited: number[] = []
    let i = 0
    for (let step = 0; step < n; step++) {
      visited.push(i)
      i = nextIndex(i, n)
    }
    // Every index reached exactly once, and `next` from the last returns home.
    expect([...visited].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, k) => k))
    expect(i).toBe(0)
  })

  it.each([1, 2, 3, 5, 8])('prev undoes next at n = %i', (n) => {
    for (let i = 0; i < n; i++) expect(prevIndex(nextIndex(i, n), n)).toBe(i)
  })
})

describe('neighborIndices', () => {
  // Order within the result is not part of the contract (it is a preload set),
  // so these compare as sets — only membership and deduplication are asserted.
  const set = (index: number, length: number) => [...neighborIndices(index, length)].sort((a, b) => a - b)

  it('is the current index plus both neighbours', () => {
    expect(set(2, 5)).toEqual([1, 2, 3])
  })

  it('wraps at both ends', () => {
    expect(set(0, 5)).toEqual([0, 1, 4])
    expect(set(4, 5)).toEqual([0, 3, 4])
  })

  it('deduplicates when the neighbours collide', () => {
    expect(set(0, 1)).toEqual([0])
    expect(set(0, 2)).toEqual([0, 1])
    expect(set(1, 2)).toEqual([0, 1])
  })

  it('starts with the current index, so a preloader loads it first', () => {
    expect(neighborIndices(2, 5)[0]).toBe(2)
    expect(neighborIndices(0, 5)[0]).toBe(0)
  })

  it('is empty for no images', () => {
    expect(neighborIndices(0, 0)).toEqual([])
  })
})

describe('colorwayPageCount', () => {
  it.each([
    [0, 1],
    [1, 1],
    [4, 1],
    [7, 1],
    // At exactly 8 the grid fills every cell and there is still no pager.
    [8, 1],
    // Above 8 the pager costs one cell per page, so it is ceil(n / 7).
    [9, 2],
    [14, 2],
    [15, 3],
    [21, 3],
    [22, 4],
    [28, 4],
    [29, 5],
  ])('%i colorways is %i page(s)', (count, expected) => {
    expect(colorwayPageCount(count)).toBe(expected)
  })

  it('is ceil(n / 7) for every count above 8', () => {
    for (let n = 9; n <= 40; n++) expect(colorwayPageCount(n)).toBe(Math.ceil(n / 7))
  })
})

describe('colorwayPage', () => {
  describe('the 8-cell identity holds for every count and every page (ADR-015)', () => {
    it.each(COUNTS)('%i colorways', (n) => {
      const colorways = swatches(n)
      const pageCount = colorwayPageCount(n)

      for (let page = 0; page < pageCount; page++) {
        const result = colorwayPage(colorways, page)
        expect(result.items.length + result.ghostCells + (result.hasPager ? 1 : 0)).toBe(
          COLORWAY_CELLS,
        )
        expect(result.ghostCells).toBeGreaterThanOrEqual(0)
        expect(result.page).toBe(page)
        expect(result.pageCount).toBe(pageCount)
      }
    })
  })

  describe('the pager occupies cell 8 on every page, partial ones included', () => {
    it.each(COUNTS.filter((n) => n > COLORWAY_CELLS))('%i colorways', (n) => {
      const colorways = swatches(n)
      const pageCount = colorwayPageCount(n)

      for (let page = 0; page < pageCount; page++) {
        const { items, ghostCells, hasPager } = colorwayPage(colorways, page)
        expect(hasPager).toBe(true)
        // Cells are laid out items, then ghosts, then the pager: the pager's
        // index is 7 (the 8th cell) exactly when the cells before it total 7.
        expect(items.length + ghostCells).toBe(COLORWAY_CELLS - 1)
      }
    })
  })

  it.each(COUNTS.filter((n) => n <= COLORWAY_CELLS))(
    'shows all %i colorways with ghost padding and no pager',
    (n) => {
      const result = colorwayPage(swatches(n), 0)
      expect(result.hasPager).toBe(false)
      expect(result.items).toEqual(swatches(n))
      expect(result.ghostCells).toBe(COLORWAY_CELLS - n)
      expect(result.pageCount).toBe(1)
    },
  )

  it('renders 8 ghost cells and nothing else for a pack with no colorways', () => {
    const result = colorwayPage([], 0)
    expect(result).toEqual({
      items: [],
      ghostCells: 8,
      hasPager: false,
      page: 0,
      pageCount: 1,
    })
  })

  it('does not page at exactly 8 — the boundary the pager must not cross', () => {
    const result = colorwayPage(swatches(8), 0)
    expect(result.hasPager).toBe(false)
    expect(result.items).toHaveLength(8)
    expect(result.ghostCells).toBe(0)
  })

  // ADR-015's worked example, verbatim.
  it('shows 7 then 2 + 5 ghosts + pager at 9 colorways', () => {
    const colorways = swatches(9)
    expect(colorwayPage(colorways, 0)).toEqual({
      items: ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
      ghostCells: 0,
      hasPager: true,
      page: 0,
      pageCount: 2,
    })
    expect(colorwayPage(colorways, 1)).toEqual({
      items: ['c7', 'c8'],
      ghostCells: 5,
      hasPager: true,
      page: 1,
      pageCount: 2,
    })
  })

  it('pages 15 colorways as 7 / 7 / 1', () => {
    const colorways = swatches(15)
    expect([0, 1, 2].map((p) => colorwayPage(colorways, p).items.length)).toEqual([7, 7, 1])
    expect(colorwayPage(colorways, 2).ghostCells).toBe(6)
  })

  it('pages 22 colorways as 7 / 7 / 7 / 1', () => {
    const colorways = swatches(22)
    expect([0, 1, 2, 3].map((p) => colorwayPage(colorways, p).items.length)).toEqual([7, 7, 7, 1])
  })

  it.each(COUNTS)('shows each of %i colorways exactly once across all pages', (n) => {
    const colorways = swatches(n)
    const seen = Array.from({ length: colorwayPageCount(n) }, (_, p) =>
      colorwayPage(colorways, p).items,
    ).flat()
    expect(seen).toEqual(colorways)
  })

  describe('paging wraps rather than clamping (ADR-016)', () => {
    it('returns to the first page from the last', () => {
      const colorways = swatches(15) // 3 pages
      expect(colorwayPage(colorways, 3).page).toBe(0)
      expect(colorwayPage(colorways, 3).items).toEqual(colorwayPage(colorways, 0).items)
    })

    it('reaches the last page going backwards from the first', () => {
      const colorways = swatches(15)
      expect(colorwayPage(colorways, -1).page).toBe(2)
      expect(colorwayPage(colorways, -1).items).toEqual(['c14'])
    })

    it('normalizes any out-of-range page a caller passes', () => {
      expect(colorwayPage(swatches(15), 7).page).toBe(1)
      expect(colorwayPage(swatches(15), -7).page).toBe(2)
      // Single-page packs collapse everything onto page 0.
      expect(colorwayPage(swatches(4), 3).page).toBe(0)
      expect(colorwayPage([], -1).page).toBe(0)
    })

    it('cycles with nextIndex over pageCount, the same idiom as the carousel', () => {
      const colorways = swatches(22)
      const { pageCount } = colorwayPage(colorways, 0)
      let page = 0
      for (let step = 0; step < pageCount; step++) page = nextIndex(page, pageCount)
      expect(page).toBe(0)
      expect(prevIndex(0, pageCount)).toBe(pageCount - 1)
    })
  })

  it('does not alias the caller’s colorway array', () => {
    const colorways = swatches(3)
    const result = colorwayPage(colorways, 0)
    result.items.push('injected')
    expect(colorways).toHaveLength(3)
  })
})
