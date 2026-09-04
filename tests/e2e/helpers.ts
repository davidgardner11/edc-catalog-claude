import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * Shared locators and measurement helpers for the E2E suite.
 *
 * **Not a spec file** — `*.spec.ts` is what Playwright globs, so this never runs
 * as a test.
 *
 * Two rules shape everything here:
 *
 * - **Locate through the accessible surface**, not through class names or test
 *   ids. A card is `<article aria-label="Brand Name">`, the carousel and the
 *   colorway grid are named `role="group"`s. Those names are part of the card's
 *   contract (ADR-024) and survive a Tailwind refactor; `.grid-rows-\[65fr...\]`
 *   would not.
 * - **Never depend on an image loading.** `public/images/` is gitignored
 *   (ADR-012) and a fresh clone has none of it, so every assertion below reads
 *   attributes and layout boxes — both of which are identical whether the bytes
 *   arrive or 404, because `width`/`height` hold the box (ADR-005).
 */

/** The shape of `app/data/catalog.json` these tests read. */
export type CatalogPack = {
  rank: number
  slug: string
  name: string
  brand: string
  images: { base: string; alt: string }[]
  colorways: { name: string; hex: string; family: string }[]
  review: { score: number; scale: number; source: string }
}

/**
 * The catalog, read from disk rather than imported: the file is JSON, the
 * package is `"type": "module"`, and a JSON import assertion is a needless
 * portability risk in a Playwright-transpiled module. It is a committed build
 * artifact (ADR-030), so this is deterministic — no network, no ingest run.
 */
export const catalog: CatalogPack[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../app/data/catalog.json', import.meta.url)), 'utf-8'),
)

/** The card's accessible name, and its `aria-label` — `"GORUCK GR1 26L"`. */
export const fullName = (pack: CatalogPack) => `${pack.brand} ${pack.name}`

/** Colorway pages for a pack: 1 at or below 8, `ceil(n / 7)` above (ADR-015). */
export const expectedPageCount = (count: number) => (count <= 8 ? 1 : Math.ceil(count / 7))

/**
 * Wait for Vue to take over the prerendered HTML.
 *
 * Without this, a click can land on server-rendered markup whose listeners are
 * not attached yet and be silently dropped — the state never changes and the
 * failure reads as "the carousel does not advance", which would be a false
 * defect report. `#__nuxt.__vue_app__` is set by `app.mount()`, so its presence
 * is the mount having happened.
 *
 * The generous timeout is for the dev server: `pnpm dev` compiles the module
 * graph on the first request, which takes seconds on a cold start and is not a
 * property of the app under test.
 */
export async function awaitHydration(page: Page) {
  await page.waitForFunction(
    () => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__),
    undefined,
    { timeout: 60_000 },
  )
}

/** `page.goto('/')` plus the hydration gate. Every spec starts here. */
export async function openGrid(page: Page, path = '/') {
  await page.goto(path)
  await expect(cards(page).first()).toBeVisible()
  await awaitHydration(page)
}

/**
 * The toolbar's result count — `"Showing 6 of 17 packs"`.
 *
 * Narrowed to a `<p role="status">` rather than `getByRole('status')`, which is
 * ambiguous on this page in two ways that have nothing to do with the catalog:
 * Nuxt's route announcer is a live region, and the price slider's `<output>`
 * carries an implicit `status` role.
 */
export const resultStatus = (page: Page): Locator =>
  page.getByRole('region', { name: 'Search, filter and sort the catalog' }).locator('p[role="status"]')

/** Every card in the grid, in rendered order. */
export const cards = (page: Page): Locator => page.locator('main ul li article')

export const cardFor = (page: Page, pack: CatalogPack): Locator =>
  page.getByRole('article', { name: fullName(pack), exact: true })

/**
 * The card's three bands, as an indexable locator: 0 carousel (65fr),
 * 1 label (15fr), 2 meta row (20fr). ADR-021 fixes both the count and the
 * order, so positional access here is the contract, not a shortcut.
 */
export const bands = (card: Locator): Locator => card.locator(':scope > *')

export const carousel = (card: Locator): Locator =>
  card.getByRole('group', { name: /images$/ })

export const swatchGrid = (card: Locator): Locator =>
  card.getByRole('group', { name: /colorways$/ })

/** The 8 cells of the colorway grid: colorways, then ghosts, then the pager. */
export const swatchCells = (card: Locator): Locator => swatchGrid(card).locator(':scope > *')

/** The `>` pager. Absent, not disabled, at 8 colorways or fewer (ADR-016). */
export const pager = (card: Locator): Locator => swatchGrid(card).getByRole('button')

/** Live region text — `"Image 3 of 5"`. Empty for a single-image pack. */
export const carouselStatus = (card: Locator): Locator =>
  carousel(card).locator('p[aria-live="polite"]')

/**
 * The score as a sighted user reads it. `ScoreBlock` renders the visible pair
 * `aria-hidden` and exposes a spoken sentence beside it, so the visible text is
 * exactly the `aria-hidden` node — `textContent` of the block would concatenate
 * both.
 */
export const scoreText = (card: Locator): Locator =>
  bands(card).nth(2).locator(':scope > div').nth(2).locator('span[aria-hidden="true"]').first()

export type Rect = { x: number; y: number; width: number; height: number }

/**
 * One `evaluate` for the whole card, so every rect is measured in the same
 * frame — measuring band-by-band across round trips could straddle a layout.
 *
 * `content` is the card's *content box* (`clientHeight`, borders excluded).
 * The three `fr` tracks divide that, not the border box, so the 65/15/20 check
 * has to compare against it or it is off by the 1px border top and bottom.
 */
export async function cardGeometry(card: Locator): Promise<{
  border: Rect
  content: { width: number; height: number }
  bands: Rect[]
}> {
  return card.evaluate((el) => {
    const round = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height })
    return {
      border: round(el.getBoundingClientRect()),
      content: { width: el.clientWidth, height: el.clientHeight },
      bands: [...el.children].map((child) => round(child.getBoundingClientRect())),
    }
  })
}

/** A rect rounded to 0.01px, so an identity comparison is not float noise. */
export const quantize = (rect: Rect): Rect => ({
  x: Math.round(rect.x * 100) / 100,
  y: Math.round(rect.y * 100) / 100,
  width: Math.round(rect.width * 100) / 100,
  height: Math.round(rect.height * 100) / 100,
})

export async function rectOf(locator: Locator): Promise<Rect> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no layout box')
  return quantize(box)
}

/**
 * A rect measured **relative to the card it lives in**, in a single evaluate.
 *
 * Viewport coordinates are useless for "did this move?": clicking a control
 * scrolls it into view, so the same unmoved element reports a different `y` on
 * the next read. Card-relative coordinates are what the question actually means
 * — the label must not move *within its card*.
 */
export async function rectInCard(locator: Locator): Promise<Rect> {
  const rect = await locator.evaluate((el) => {
    const card = el.closest('article')
    if (!card) throw new Error('element is not inside a card')
    const parent = card.getBoundingClientRect()
    const own = el.getBoundingClientRect()
    return { x: own.x - parent.x, y: own.y - parent.y, width: own.width, height: own.height }
  })
  return quantize(rect)
}

/** A rect in document coordinates — stable across scrolling, unlike a bounding box. */
export async function rectInDocument(locator: Locator): Promise<Rect> {
  const rect = await locator.evaluate((el) => {
    const own = el.getBoundingClientRect()
    return { x: own.x + window.scrollX, y: own.y + window.scrollY, width: own.width, height: own.height }
  })
  return quantize(rect)
}

/**
 * Click a fraction across an element — `0.25` is the left half, `0.75` the
 * right. Deliberately a **positional** click rather than pressing the named
 * button: the requirement is that the halves of the image region are the hit
 * targets, and clicking the button by name would pass even if the zone were one
 * pixel wide.
 *
 * `yFraction` defaults to 0.4 to stay clear of the dot strip, which sits in its
 * own row below the image (ADR-024) and is not a control.
 */
export async function clickAt(locator: Locator, xFraction: number, yFraction = 0.4) {
  // Scroll first, then measure: `mouse.click` takes viewport coordinates, and a
  // card below the fold would otherwise be clicked at a point off-screen.
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no layout box')
  await locator.page().mouse.click(box.x + box.width * xFraction, box.y + box.height * yFraction)
}

/**
 * Which carousel image is showing, by `src` — the images are all mounted and
 * toggled with `v-show` (ADR-024), so "showing" means the one whose `picture` is
 * not `display: none`. Reads the attribute, never a loaded pixel.
 */
export async function visibleImageSrc(card: Locator): Promise<string> {
  return carousel(card).evaluate((el) => {
    const shown = [...el.querySelectorAll('picture')].filter(
      (picture) => getComputedStyle(picture).display !== 'none',
    )
    if (shown.length !== 1) {
      throw new Error(`expected exactly 1 visible image, found ${shown.length}`)
    }
    return shown[0]!.querySelector('img')!.getAttribute('src') ?? ''
  })
}

/** The colorway names on the current page, in cell order. */
export async function visibleSwatchNames(card: Locator): Promise<string[]> {
  return swatchGrid(card).evaluate((el) =>
    [...el.querySelectorAll('[title]')].map((cell) => cell.getAttribute('title') ?? ''),
  )
}
