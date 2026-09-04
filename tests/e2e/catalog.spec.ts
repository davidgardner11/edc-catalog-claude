import { expect, test } from '@playwright/test'
import { cardFor, cards, catalog, fullName, openGrid, resultStatus, scoreText } from './helpers'

/**
 * What band 3 renders, and the URL-backed filter state (ADR-034).
 *
 * The reload test is the one with a timing trap: `useCatalogFilters` ignores the
 * query until `onMounted` (the hydration gate), so the unfiltered catalog paints
 * for a frame before the filter applies. Every assertion after a `reload()`
 * therefore goes through a retrying `expect`, never a bare read — a snapshot
 * taken on first paint would fail for a reason that is not a bug.
 */

/** The plan's formatting rule: `${score.toFixed(1)}/${scale.toFixed(1)}`. */
const SCORE_PATTERN = /^\d+\.\d\/\d+\.\d$/

/** A colour family carried by several packs but not by all of them. */
const FAMILY = 'olive'
const FAMILY_LABEL = 'Olive'
const expectedMatches = catalog.filter((pack) =>
  pack.colorways.some((colorway) => colorway.family === FAMILY),
)

test.beforeEach(async ({ page }) => {
  await openGrid(page)
})

test('every rendered score matches the two-scale display format', async ({ page }) => {
  expect(expectedMatches.length).toBeGreaterThan(0)

  for (const pack of catalog) {
    const text = (await scoreText(cardFor(page, pack)).textContent())?.trim() ?? ''
    expect(text, `${fullName(pack)} score`).toMatch(SCORE_PATTERN)
    // ADR-010: the raw pair is displayed, and the scale is shown rather than
    // implied — a 4.9 on a 5.0 scale and an 8.6 on a 10.0 scale both render
    // their own divisor.
    expect(text, `${fullName(pack)} shows its own scale`).toBe(
      `${pack.review.score.toFixed(1)}/${pack.review.scale.toFixed(1)}`,
    )
  }
})

test('both review scales are visible in the grid', async ({ page }) => {
  const rendered = await Promise.all(
    catalog.map(async (pack) => (await scoreText(cardFor(page, pack)).textContent())?.trim()),
  )
  expect(rendered.some((text) => text?.endsWith('/5.0'))).toBe(true)
  expect(rendered.some((text) => text?.endsWith('/10.0'))).toBe(true)
})

test('an unfiltered catalog carries no query parameters', async ({ page }) => {
  // ADR-034: a parameter at its default is absent, not written empty.
  expect(new URL(page.url()).search).toBe('')
})

test('filtering by a colour family survives a reload', async ({ page }) => {
  const status = resultStatus(page)
  await expect(status).toHaveText(`Showing ${catalog.length} of ${catalog.length} packs`)

  await page.locator('summary').click()
  await page.getByRole('group', { name: 'Colour' }).getByRole('checkbox', { name: FAMILY_LABEL }).check()

  await expect(status).toHaveText(`Showing ${expectedMatches.length} of ${catalog.length} packs`)
  await expect(cards(page)).toHaveCount(expectedMatches.length)
  expect(new URL(page.url()).searchParams.get('color')).toBe(FAMILY)

  const before = await cards(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('aria-label')),
  )
  // Copies: `sort` is in place, and `before` is compared in render order below.
  expect([...before].sort()).toEqual(expectedMatches.map(fullName).sort())

  const urlBefore = page.url()
  await page.reload()

  // The hydration gate (ADR-034) paints the full catalog for a frame; these
  // retry until the filter has applied rather than asserting on first paint.
  await expect(status).toHaveText(`Showing ${expectedMatches.length} of ${catalog.length} packs`)
  await expect(cards(page)).toHaveCount(expectedMatches.length)

  const after = await cards(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('aria-label')),
  )
  expect(after, 'the same packs, in the same order').toEqual(before)
  expect(page.url(), 'the URL is unchanged by the round trip').toBe(urlBefore)

  // The control that produced the view is restored too, not just the results.
  await page.locator('summary').click()
  await expect(
    page.getByRole('group', { name: 'Colour' }).getByRole('checkbox', { name: FAMILY_LABEL }),
  ).toBeChecked()
})

test('a filtered view is reachable directly by URL', async ({ page }) => {
  await openGrid(page, `/?color=${FAMILY}`)
  await expect(resultStatus(page)).toHaveText(
    `Showing ${expectedMatches.length} of ${catalog.length} packs`,
  )
  await expect(cards(page)).toHaveCount(expectedMatches.length)
})

test('a hand-edited URL with an unknown colour family degrades to the full catalog', async ({
  page,
}) => {
  // ADR-034: the parser is total — a stale bookmark drops the dead facet rather
  // than erroring.
  await openGrid(page, '/?color=chartreuse')
  await expect(resultStatus(page)).toHaveText(
    `Showing ${catalog.length} of ${catalog.length} packs`,
  )
  await expect(cards(page)).toHaveCount(catalog.length)
})
