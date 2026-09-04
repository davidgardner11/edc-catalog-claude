import { expect, test } from '@playwright/test'
import { bands, cardFor, cardGeometry, cards, catalog, fullName, openGrid } from './helpers'

/**
 * Card geometry (ADR-021, ADR-024) — the one part of the card that only a
 * browser can check.
 *
 * The contract: `aspect-[5/7]` on the shell, `grid-rows-[65fr_15fr_20fr]`
 * inside, and `min-h-0` on every band so no child can stretch its track. The
 * assertions below are written against those ratios, not against whatever the
 * SFC currently sets — the point is to fail if a band grows, whatever the cause.
 */

const ASPECT = 5 / 7
/** 0.5% of 0.714 is ~0.004 — a pixel of rounding on a 320px card, no more. */
const ASPECT_TOLERANCE = 0.004

const BAND_RATIOS = [0.65, 0.15, 0.2] as const
const BAND_NAMES = ['carousel', 'label', 'meta row'] as const
/**
 * `toBeCloseTo(expected, 0)` is "within half a pixel". Fractional `fr` tracks
 * land on subpixels, so exact equality is not available; half a pixel is far
 * tighter than any real band-growth bug, which costs whole text lines.
 */
const BAND_PRECISION = 0

/** The two cards most likely to break the split, by their content. */
const longestName = [...catalog].sort((a, b) => b.name.length - a.name.length)[0]!
const mostColorways = [...catalog].sort((a, b) => b.colorways.length - a.colorways.length)[0]!

test.beforeEach(async ({ page }) => {
  await openGrid(page)
})

test('every card renders one card per pack', async ({ page }) => {
  await expect(cards(page)).toHaveCount(catalog.length)
})

test('every card is 5:7 and splits 65/15/20', async ({ page }) => {
  const all = await cards(page).all()
  expect(all).toHaveLength(catalog.length)

  for (const [i, card] of all.entries()) {
    const label = await card.getAttribute('aria-label')
    const geometry = await cardGeometry(card)

    expect(
      geometry.border.width / geometry.border.height,
      `card ${i} (${label}) aspect ratio`,
    ).toBeCloseTo(ASPECT, 2)
    expect(
      Math.abs(geometry.border.width / geometry.border.height - ASPECT),
      `card ${i} (${label}) aspect ratio within tolerance`,
    ).toBeLessThanOrEqual(ASPECT_TOLERANCE)

    // Exactly three bands. A fourth child would divide the tracks differently
    // and every ratio below would still pass on the first three.
    expect(geometry.bands, `card ${i} (${label}) band count`).toHaveLength(3)

    for (const [b, ratio] of BAND_RATIOS.entries()) {
      expect(
        geometry.bands[b]!.height,
        `card ${i} (${label}) band ${b + 1} (${BAND_NAMES[b]}) is ${ratio * 100}% of the card`,
      ).toBeCloseTo(geometry.content.height * ratio, BAND_PRECISION)
    }

    // The bands tile the content box: no gap, no overlap, nothing spilling out.
    const stacked = geometry.bands.reduce((sum, band) => sum + band.height, 0)
    expect(stacked, `card ${i} (${label}) bands fill the card`).toBeCloseTo(
      geometry.content.height,
      0,
    )
    expect(geometry.bands[1]!.y, `card ${i} band 2 follows band 1`).toBeCloseTo(
      geometry.bands[0]!.y + geometry.bands[0]!.height,
      0,
    )
    expect(geometry.bands[2]!.y, `card ${i} band 3 follows band 2`).toBeCloseTo(
      geometry.bands[1]!.y + geometry.bands[1]!.height,
      0,
    )
  }
})

test(`holds the split on the longest name in the catalog (${longestName.name})`, async ({
  page,
}) => {
  const geometry = await cardGeometry(cardFor(page, longestName))
  for (const [b, ratio] of BAND_RATIOS.entries()) {
    expect(geometry.bands[b]!.height, `band ${b + 1}`).toBeCloseTo(
      geometry.content.height * ratio,
      0,
    )
  }
})

test(`holds the split on the largest colorway count (${mostColorways.colorways.length})`, async ({
  page,
}) => {
  const geometry = await cardGeometry(cardFor(page, mostColorways))
  for (const [b, ratio] of BAND_RATIOS.entries()) {
    expect(geometry.bands[b]!.height, `band ${b + 1}`).toBeCloseTo(
      geometry.content.height * ratio,
      0,
    )
  }
})

/**
 * ADR-021 names 260px as the worst case to verify: the card is then 364px tall,
 * band 2 gets 55px for two text lines and band 3 gets 73px for two rows of
 * swatches plus two text lines. If anything is going to overflow its track and
 * push a band, it is here.
 */
test('holds the split at the 260px worst case', async ({ page }) => {
  await page.setViewportSize({ width: 292, height: 900 })
  await expect(cards(page).first()).toBeVisible()

  for (const card of await cards(page).all()) {
    const label = await card.getAttribute('aria-label')
    const geometry = await cardGeometry(card)

    expect(geometry.border.width, `${label} is at its minimum width`).toBeLessThanOrEqual(268)
    expect(geometry.border.width, `${label} never squeezes below 260px`).toBeGreaterThanOrEqual(259)

    expect(
      Math.abs(geometry.border.width / geometry.border.height - ASPECT),
      `${label} aspect ratio at 260px`,
    ).toBeLessThanOrEqual(ASPECT_TOLERANCE)

    for (const [b, ratio] of BAND_RATIOS.entries()) {
      expect(geometry.bands[b]!.height, `${label} band ${b + 1} at 260px`).toBeCloseTo(
        geometry.content.height * ratio,
        0,
      )
    }
  }
})

test('band 2 never wraps to a second line', async ({ page }) => {
  for (const pack of catalog) {
    const heading = cardFor(page, pack).getByRole('heading', { level: 3 })
    const lines = await heading.evaluate((el) => ({
      // A wrapped line renders as a second client rect and grows scrollHeight
      // past the single-line box.
      rects: el.getClientRects().length,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    }))
    expect(lines.rects, `${fullName(pack)} model name is one line`).toBe(1)
    expect(lines.scrollHeight, `${fullName(pack)} model name does not wrap`).toBeLessThanOrEqual(
      lines.clientHeight + 1,
    )
  }
})

/**
 * The catalog's longest model name is 24 characters, which fits — so the real
 * requirement ("a very long name truncates rather than wrapping the band
 * taller") is not actually exercised by the shipped data. This forces it: the
 * heading text is replaced in the DOM with a name no card could fit, and the
 * band must be unmoved.
 *
 * This edits the rendered page, never the app: it is the browser equivalent of
 * passing a hostile prop.
 */
test('a very long model name truncates instead of growing band 2', async ({ page }) => {
  const card = cardFor(page, catalog[0]!)
  const before = await cardGeometry(card)

  const heading = bands(card).nth(1).getByRole('heading', { level: 3 })
  await heading.evaluate((el) => {
    el.textContent = 'Absurdly Long Model Name That No Card Could Ever Hope To Fit '.repeat(4)
  })

  const after = await cardGeometry(card)

  expect(after.border.height, 'card height').toBeCloseTo(before.border.height, 0)
  for (const [b, ratio] of BAND_RATIOS.entries()) {
    expect(after.bands[b]!.height, `band ${b + 1} after a 240-character name`).toBeCloseTo(
      after.content.height * ratio,
      0,
    )
    expect(after.bands[b]!.height, `band ${b + 1} is unchanged`).toBeCloseTo(
      before.bands[b]!.height,
      0,
    )
  }

  const clipped = await heading.evaluate((el) => ({
    rects: el.getClientRects().length,
    overflowing: el.scrollWidth > el.clientWidth,
    ellipsis: getComputedStyle(el).textOverflow,
  }))
  expect(clipped.rects, 'the long name stays on one line').toBe(1)
  expect(clipped.overflowing, 'the long name is clipped, not shrunk to fit').toBe(true)
  expect(clipped.ellipsis).toBe('ellipsis')
})
