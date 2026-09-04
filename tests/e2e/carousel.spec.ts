import { expect, test } from '@playwright/test'
import {
  bands,
  cardFor,
  carousel,
  carouselStatus,
  catalog,
  clickAt,
  fullName,
  openGrid,
  rectInCard,
  rectInDocument,
  visibleImageSrc,
} from './helpers'
import type { CatalogPack } from './helpers'

/**
 * The carousel: click zones, wraparound (ADR-016), and the label that must not
 * move (ADR-021).
 *
 * Clicks are **positional** — the left and right halves of the image region are
 * the requirement, so pressing the named button instead would pass even if the
 * zone had collapsed to a sliver.
 *
 * The current state is read as the `src` of the one `<picture>` that is not
 * `display: none`. That is an attribute, not a pixel: `public/images/` is
 * gitignored (ADR-012) and these assertions hold on a fresh clone where every
 * image 404s.
 */

/** One pack per distinct image count, so every carousel length in the catalog is covered. */
const byImageCount = new Map<number, CatalogPack>()
for (const pack of catalog) {
  if (!byImageCount.has(pack.images.length)) byImageCount.set(pack.images.length, pack)
}
const samples = [...byImageCount.entries()].sort(([a], [b]) => a - b)

for (const [count, pack] of samples) {
  test.describe(`${fullName(pack)} — ${count} images`, () => {
    test.beforeEach(({ page }) => openGrid(page))

    test('starts on the first image', async ({ page }) => {
      const card = cardFor(page, pack)
      expect(await visibleImageSrc(card)).toContain(`${pack.images[0]!.base}-`)
      await expect(carouselStatus(card)).toHaveText(`Image 1 of ${count}`)
    })

    test('clicking the right half advances, and the last image wraps to the first', async ({
      page,
    }) => {
      const card = cardFor(page, pack)
      const region = carousel(card)

      for (let step = 1; step <= count; step++) {
        await clickAt(region, 0.75)
        // After `count` clicks we are back at image 0 — modulo, not a clamp on
        // the last image (ADR-016).
        const expected = step % count
        await expect(
          carouselStatus(card),
          `click ${step} of ${count} shows image ${expected + 1}`,
        ).toHaveText(`Image ${expected + 1} of ${count}`)
        expect(await visibleImageSrc(card)).toContain(`${pack.images[expected]!.base}-`)
      }
    })

    test('clicking the left half retreats, and the first image wraps to the last', async ({
      page,
    }) => {
      const card = cardFor(page, pack)
      const region = carousel(card)

      for (let step = 1; step <= count; step++) {
        await clickAt(region, 0.25)
        const expected = (count - step) % count
        await expect(
          carouselStatus(card),
          `back-click ${step} of ${count} shows image ${expected + 1}`,
        ).toHaveText(`Image ${expected + 1} of ${count}`)
        expect(await visibleImageSrc(card)).toContain(`${pack.images[expected]!.base}-`)
      }
    })

    test('exactly one image is shown at a time', async ({ page }) => {
      const card = cardFor(page, pack)
      const seen = new Set<string>()
      for (let step = 0; step < count; step++) {
        // `visibleImageSrc` throws unless exactly one picture is displayed.
        seen.add(await visibleImageSrc(card))
        await clickAt(carousel(card), 0.75)
      }
      expect(seen.size, 'every image is reachable and distinct').toBe(count)
    })

    /**
     * **The headline regression guard.** Since ADR-021 the label lives in band
     * 2, a different grid row from the carousel, so nothing that changes on an
     * image swap can reach it — this is structural, and this test is what
     * notices if someone puts the label back on the photo.
     *
     * Compared across **all N images**, not just the first and last: an overlay
     * label that shifts with a portrait image and shifts back on the next
     * landscape one would pass an endpoints-only check.
     */
    test('the label’s text and box are identical on every image', async ({ page }) => {
      const card = cardFor(page, pack)
      const label = bands(card).nth(1)
      // The band *and* the model-name element inside it: a band that keeps its
      // box while its contents shift would satisfy the outer measurement alone.
      const heading = label.getByRole('heading', { level: 3 })

      const read = async () => ({
        text: (await label.textContent())?.trim(),
        band: await rectInCard(label),
        heading: await rectInCard(heading),
        headingText: (await heading.textContent())?.trim(),
      })

      const first = await read()

      for (let step = 1; step <= count; step++) {
        await clickAt(carousel(card), 0.75)
        await expect(carouselStatus(card)).toHaveText(`Image ${(step % count) + 1} of ${count}`)
        expect(await read(), `label on image ${(step % count) + 1}`).toEqual(first)
      }

      // And it really is the brand and model in there, not an empty box that
      // trivially never moves. If someone puts the label back on the photo
      // (ADR-021), band 2 stops containing the name and this fails.
      expect(first.text).toContain(pack.brand)
      expect(first.text).toContain(pack.name)
      expect(first.headingText).toBe(pack.name)
    })
  })
}

test.describe('across the whole grid', () => {
  test.beforeEach(({ page }) => openGrid(page))

  test('every card’s label survives a full cycle of its own carousel', async ({ page }) => {
    for (const pack of catalog) {
      const card = cardFor(page, pack)
      const label = bands(card).nth(1)
      const before = { text: (await label.textContent())?.trim(), rect: await rectInCard(label) }

      for (let step = 0; step < pack.images.length; step++) await clickAt(carousel(card), 0.75)

      expect((await label.textContent())?.trim(), `${fullName(pack)} label text`).toBe(before.text)
      expect(await rectInCard(label), `${fullName(pack)} label box`).toEqual(before.rect)
      // A full cycle returns to image 1 — the wrap is not a one-off.
      await expect(carouselStatus(card)).toHaveText(`Image 1 of ${pack.images.length}`)
    }
  })

  test('cycling one card moves no other card', async ({ page }) => {
    const [first, second] = [cardFor(page, catalog[0]!), cardFor(page, catalog[1]!)]
    // Document coordinates, not viewport: clicking the first card may scroll
    // the page, which moves every bounding box without moving any element.
    const before = await rectInDocument(second)
    const beforeImage = await visibleImageSrc(second)

    await clickAt(carousel(first), 0.75)

    expect(await rectInDocument(second)).toEqual(before)
    expect(await visibleImageSrc(second), 'carousel index is per-card state').toBe(beforeImage)
  })

  test('the image region carries no navigation — clicking it stays on the grid', async ({
    page,
  }) => {
    const card = cardFor(page, catalog[0]!)
    await clickAt(carousel(card), 0.75)
    await clickAt(carousel(card), 0.25)
    expect(new URL(page.url()).pathname).toBe('/')
  })
})
