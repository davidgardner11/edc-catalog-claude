import { expect, test } from '@playwright/test'
import {
  cardFor,
  carouselStatus,
  catalog,
  expectedPageCount,
  fullName,
  openGrid,
  pager,
  rectInCard,
  swatchCells,
  swatchGrid,
  visibleImageSrc,
  visibleSwatchNames,
} from './helpers'

/**
 * The colorway grid (ADR-015) and its pager (ADR-016).
 *
 * The geometry invariant is that **every card shows exactly 8 cells**, whatever
 * its colorway count, and that the `>` pager is the 8th one on every page —
 * including a partial final page, so the hit target never moves. That is what
 * makes all 17 cards the same shape.
 *
 * Swatch *colour* is deliberately never asserted: sampling is best-effort and
 * not hex-identical (ADR-029).
 */

const paged = catalog.filter((pack) => pack.colorways.length > 8)
const unpaged = catalog.filter((pack) => pack.colorways.length <= 8)

test.beforeEach(async ({ page }) => {
  await openGrid(page)
})

test('every card renders exactly 8 swatch cells', async ({ page }) => {
  for (const pack of catalog) {
    await expect(
      swatchCells(cardFor(page, pack)),
      `${fullName(pack)} has ${pack.colorways.length} colorways`,
    ).toHaveCount(8)
  }
})

test('the swatch grid is the same size and shape on every card', async ({ page }) => {
  const sizes = new Set<string>()
  for (const pack of catalog) {
    const rect = await rectInCard(swatchGrid(cardFor(page, pack)))
    sizes.add(`${rect.width}x${rect.height}`)
  }
  // One distinct size across a 2-colorway card and a 14-colorway one is the
  // whole point of the ghost padding.
  expect([...sizes]).toHaveLength(1)
})

test('a card with 8 colorways or fewer shows no pager, and no disabled control', async ({
  page,
}) => {
  for (const pack of unpaged) {
    const card = cardFor(page, pack)
    await expect(pager(card), `${fullName(pack)} pager`).toHaveCount(0)
    // ADR-016: a control that cannot do anything is not rendered greyed out —
    // it is not rendered.
    await expect(card.locator('button[disabled]')).toHaveCount(0)
  }
})

for (const pack of paged) {
  const count = pack.colorways.length
  const pageCount = expectedPageCount(count)

  test(`${fullName(pack)} — ${count} colorways page ${pageCount} ways and wrap`, async ({
    page,
  }) => {
    const card = cardFor(page, pack)
    await expect(pager(card)).toHaveCount(1)

    // Card-relative: a click scrolls the card, so viewport coordinates would
    // differ between pages for an element that never moved.
    const pagerRect = await rectInCard(pager(card))
    const gridRect = await rectInCard(swatchGrid(card))
    const seen: string[][] = []

    for (let index = 0; index < pageCount; index++) {
      // Eight cells on every page, including the partial last one.
      await expect(swatchCells(card), `page ${index + 1} cell count`).toHaveCount(8)

      // The pager is the 8th cell: last in DOM order, and bottom-right of the
      // 4x2 grid. Both, because either alone can be satisfied while the control
      // still visibly moves.
      const cells = await swatchCells(card).all()
      const lastCellText = await cells[7]!.evaluate((el) => el.tagName)
      expect(lastCellText, `page ${index + 1}: cell 8 is the pager button`).toBe('BUTTON')

      const here = await rectInCard(pager(card))
      expect(here, `page ${index + 1}: the pager has not moved`).toEqual(pagerRect)
      expect(here.x + here.width, 'pager is in the last column').toBeCloseTo(
        gridRect.x + gridRect.width,
        0,
      )
      expect(here.y + here.height, 'pager is in the second row').toBeCloseTo(
        gridRect.y + gridRect.height,
        0,
      )

      const names = await visibleSwatchNames(card)
      const expectedNames = pack.colorways
        .slice(index * 7, index * 7 + 7)
        .map((colorway) => colorway.name)
      expect(names, `page ${index + 1} shows colorways ${index * 7 + 1}-${index * 7 + names.length}`)
        .toEqual(expectedNames)
      seen.push(names)

      await pager(card).click()
    }

    // The click at the end of the final iteration was made from the last page:
    // it must land back on the first (ADR-016), not stop.
    expect(await visibleSwatchNames(card), 'the last page wraps to the first').toEqual(seen[0])

    // And every colorway was reachable — paging that skipped some would still
    // satisfy the wrap.
    expect(seen.flat()).toEqual(pack.colorways.map((colorway) => colorway.name))
  })

  test(`${fullName(pack)} — the pager neither navigates nor advances the carousel`, async ({
    page,
  }) => {
    const card = cardFor(page, pack)
    const imageBefore = await visibleImageSrc(card)
    const statusBefore = await carouselStatus(card).textContent()

    await pager(card).click()

    // ADR-015: the pager's handler stops propagation, so the card-level
    // navigation never fires and the click never reaches the image region.
    expect(new URL(page.url()).pathname, 'still on the grid').toBe('/')
    expect(await visibleImageSrc(card), 'carousel did not advance').toBe(imageBefore)
    expect(await carouselStatus(card).textContent()).toBe(statusBefore)
  })
}

test('paging one card does not page another', async ({ page }) => {
  test.skip(paged.length < 2, 'needs two packs with more than 8 colorways')
  const [first, second] = [cardFor(page, paged[0]!), cardFor(page, paged[1]!)]
  const before = await visibleSwatchNames(second)

  await pager(first).click()

  expect(await visibleSwatchNames(second), 'page index is per-card state').toEqual(before)
})
