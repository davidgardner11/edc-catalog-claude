import { describe, expect, it } from 'vitest'
import type { ColorFamily } from '../../app/types/backpack'
import { COLOR_FAMILIES, colorFamilyLabel, colorFamilyFromName } from '../../app/utils/color'
import { fixtureBackpacks } from '../../app/data/fixtures'

/**
 * `app/utils/color.ts` — the closed `ColorFamily` union as data (ADR-022).
 *
 * The failure mode this module exists to prevent is ingest and the Phase 6
 * filter facets disagreeing about the family list, so the coverage tests are
 * driven off `COLOR_FAMILIES` itself and off a `Record<ColorFamily, ...>`,
 * never off a hand-written array that can go stale independently.
 */

/**
 * Widening the union without adding a row here is a type error, so this object
 * is the type-level half of the coverage check; the runtime half compares its
 * keys with `COLOR_FAMILIES`.
 */
const EVERY_FAMILY: Record<ColorFamily, true> = {
  black: true,
  grey: true,
  white: true,
  navy: true,
  blue: true,
  green: true,
  olive: true,
  tan: true,
  brown: true,
  red: true,
  orange: true,
  purple: true,
  multi: true,
}

describe('COLOR_FAMILIES', () => {
  it('lists every member of the union exactly once', () => {
    expect([...COLOR_FAMILIES].sort()).toEqual(Object.keys(EVERY_FAMILY).sort())
    expect(new Set(COLOR_FAMILIES).size).toBe(COLOR_FAMILIES.length)
  })

  it('is the 13-member set ADR-022 closed on', () => {
    expect(COLOR_FAMILIES).toHaveLength(13)
  })

  it('orders neutrals, then cool, then warm, then multi', () => {
    // Display order for the Phase 6 filter; `multi` is last by design.
    expect(COLOR_FAMILIES[0]).toBe('black')
    expect(COLOR_FAMILIES[COLOR_FAMILIES.length - 1]).toBe('multi')
  })
})

describe('colorFamilyLabel', () => {
  // Driven off COLOR_FAMILIES so a new family cannot be added without a label.
  it.each([...COLOR_FAMILIES])('has a non-empty label for %s', (family) => {
    const label = colorFamilyLabel(family)
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
    expect(label).not.toBe('undefined')
  })

  it('gives every family a distinct label', () => {
    const labels = COLOR_FAMILIES.map(colorFamilyLabel)
    expect(new Set(labels).size).toBe(COLOR_FAMILIES.length)
  })

  it('capitalises for UI and spells multi out', () => {
    expect(colorFamilyLabel('black')).toBe('Black')
    expect(colorFamilyLabel('multi')).toBe('Multicolour')
  })
})

describe('colorFamilyFromName', () => {
  it.each<[string, ColorFamily]>([
    ['Black', 'black'],
    ['Gray', 'grey'],
    ['Wolf Grey', 'grey'],
    // Corrected fixture: `steel` is in the grey keyword row, not blue.
    ['Steel', 'grey'],
    ['Bone White', 'white'],
    ['Navy', 'navy'],
    ['Pond Blue', 'blue'],
    ['Forest', 'green'],
    ['Ranger Green', 'green'],
    ['Olive', 'olive'],
    ['Khaki', 'tan'],
    ['Coyote Brown', 'brown'],
    ['Peppercorn', 'brown'],
    ['Oxblood', 'red'],
    ['Burgundy', 'red'],
    ['Clay', 'orange'],
    ['Plum', 'purple'],
    ['Multicam', 'multi'],
    ['Geo Print', 'multi'],
  ])('maps %s to %s', (name, family) => {
    expect(colorFamilyFromName(name)).toBe(family)
  })

  describe('keyword order is load-bearing', () => {
    it('treats a print as multi even when it names a colour', () => {
      expect(colorFamilyFromName('Multicam Black')).toBe('multi')
      expect(colorFamilyFromName('Green Camo')).toBe('multi')
    })

    it('keeps navy out of blue and olive out of green', () => {
      expect(colorFamilyFromName('Navy Blue')).toBe('navy')
      expect(colorFamilyFromName('Olive Green')).toBe('olive')
    })

    it('resolves Desert Palm on palm rather than desert', () => {
      expect(colorFamilyFromName('Desert Palm')).toBe('olive')
      expect(colorFamilyFromName('Desert Tan')).toBe('tan')
    })
  })

  it('is case-insensitive', () => {
    expect(colorFamilyFromName('BLACK')).toBe('black')
    expect(colorFamilyFromName('charcoal')).toBe('grey')
    expect(colorFamilyFromName('CoYoTe')).toBe('brown')
  })

  // The point of the null: a silent `multi` fallback would bucket every
  // unrecognized name into one facet and hide the gap from ingest (ADR-022).
  it.each(['', 'Zephyr', 'Heather', 'Series 2', 'Limited Edition'])(
    'returns null for the unmapped name %o',
    (name) => {
      expect(colorFamilyFromName(name)).toBeNull()
    },
  )

  it('never falls back to multi', () => {
    const unmapped = ['Zephyr', 'Heather', 'Series 2']
    expect(unmapped.map(colorFamilyFromName)).not.toContain('multi')
  })
})

describe('fixtures agree with the keyword table', () => {
  const colorways = fixtureBackpacks.flatMap((pack) =>
    pack.colorways.map((c) => [pack.slug, c.name, c.family] as const),
  )

  it.each(colorways)('%s: %s is declared %s', (_slug, name, family) => {
    expect(colorFamilyFromName(name)).toBe(family)
  })

  it('only declares families that are in the closed union', () => {
    for (const [, , family] of colorways) expect(COLOR_FAMILIES).toContain(family)
  })
})
