/**
 * The zod schemas for both ends of the pipeline: the hand-authored research
 * capture (`data/sources/{slug}.json`) and the generated catalog
 * (`app/data/catalog.json`).
 *
 * The catalog schema is the load-bearing one. `app/types/backpack.ts` is
 * structural and cannot express the invariants the components rely on, so they
 * live here and a violation fails the build rather than reaching a card
 * (implementation-plan.md, "Ingest pipeline"):
 *
 *   - `Colorway.hex` is a 6-digit hex          — components assume it is paintable
 *   - `Colorway.family` is a `ColorFamily`     — ADR-022; a typo must not vanish
 *                                                from the Phase 6 colour filter
 *   - `images` is 1-5 long                     — ADR-008
 *   - `widths` is exactly [640, 1280]          — ADR-005; srcset is built from it
 *   - `rank` is 1-20 and unique
 *   - `slug` is unique and /^[a-z0-9-]+$/      — it is a URL segment and a directory name
 *   - `review.scale` is 5 or 10                — ADR-010
 *   - `review.score` is > 0 and <= scale
 *   - both `capturedAt` values parse as ISO dates (ADR-009)
 *
 * The `ColorFamily` list is imported from `app/utils/color.ts`, never restated.
 * ADR-022's failure mode is ingest and the toolbar keeping separate lists that
 * drift apart in silence.
 */
import { z } from 'zod'
import { COLOR_FAMILIES } from '../../app/utils/color.ts'
import type { Backpack, CarouselImage, Colorway } from '../../app/types/backpack.ts'

/** The two emitted widths (ADR-005). Exported so the encoder cannot disagree with the schema. */
export const IMAGE_WIDTHS = [640, 1280] as const

const HEX_RE = /^#[0-9a-f]{6}$/i
const SLUG_RE = /^[a-z0-9-]+$/

/**
 * An ISO-8601 instant that actually parses. Stored as a string in the contract
 * because `catalog.json` is JSON, but a value the UI cannot render as a date is
 * worse than no value — the UI's whole job with these is to say "captured on".
 */
const isoInstant = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'must be an ISO-8601 date-time' })

/** `z.enum` over the single shared list — see the module comment. */
export const colorFamilySchema = z.enum(COLOR_FAMILIES)

// ---------------------------------------------------------------------------
// data/sources/{slug}.json — the research capture
// ---------------------------------------------------------------------------

/**
 * `family` is optional: ingest derives it from the colorway name with
 * `colorFamilyFromName`, and an explicit value here overrides that guess. It is
 * still validated against the union, so an override cannot smuggle in a
 * fourteenth family (ADR-022).
 *
 * `swatchSource` records *which* brand photograph the hex was sampled from, so
 * the value is auditable rather than an eyeballed guess.
 */
const sourceColorwaySchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(HEX_RE, 'must be a 6-digit hex colour, e.g. #1a2b3c'),
  family: colorFamilySchema.optional(),
  swatchSource: z.url().optional(),
})

const sourceImageSchema = z.object({
  url: z.url(),
  /** Overrides the generated "Brand Model — view N of M" alt text. */
  alt: z.string().min(1).optional(),
})

/**
 * ADR-017 wants the lowest price across brand-direct plus 1-2 major retailers.
 * Recording what was *checked* — including the retailers that refused an
 * automated request — is what makes "lowest available price" an auditable claim
 * rather than an assertion.
 */
const priceComparisonSchema = z.object({
  retailer: z.string().min(1),
  url: z.url().optional(),
  amountUsd: z.number().positive().optional(),
  /** Free text: "captured", "HTTP 403 (Cloudflare challenge)", "no listing". */
  outcome: z.string().min(1),
})

export const sourceSchema = z
  .object({
    slug: z.string().regex(SLUG_RE),
    /** Brand-direct product page these values were read off. */
    productUrl: z.url(),
    images: z.array(sourceImageSchema).min(1).max(5),
    colorways: z.array(sourceColorwaySchema).default([]),
    price: z.object({
      amountUsd: z.number().positive(),
      retailer: z.string().min(1),
      url: z.url(),
      capturedAt: isoInstant,
    }),
    priceComparison: z.array(priceComparisonSchema).default([]),
    review: z.object({
      score: z.number().positive(),
      scale: z.union([z.literal(5), z.literal(10)]),
      source: z.string().min(1),
      url: z.url(),
      capturedAt: isoInstant,
    }),
    specs: z
      .object({
        capacityLiters: z.number().positive().optional(),
        weightGrams: z.number().positive().optional(),
        dimensions: z.string().min(1).optional(),
        material: z.string().min(1).optional(),
      })
      .optional(),
    /** Anything a human needs to know about how this capture was made. */
    notes: z.string().optional(),
  })
  .check((ctx) => {
    if (ctx.value.review.score > ctx.value.review.scale) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value.review,
        path: ['review', 'score'],
        message: `score ${ctx.value.review.score} exceeds scale ${ctx.value.review.scale}`,
      })
    }
    const names = ctx.value.colorways.map((c) => c.name)
    const duplicate = names.find((n, i) => names.indexOf(n) !== i)
    if (duplicate !== undefined) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value.colorways,
        path: ['colorways'],
        message: `duplicate colorway name: ${duplicate}`,
      })
    }
  })

export type SourceCapture = z.infer<typeof sourceSchema>

// ---------------------------------------------------------------------------
// app/data/catalog.json — the generated contract
// ---------------------------------------------------------------------------

const colorwaySchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(HEX_RE),
  family: colorFamilySchema,
})

const carouselImageSchema = z.object({
  // "/images/{slug}/{n}" — no width, no extension; the component appends both.
  base: z.string().regex(/^\/images\/[a-z0-9-]+\/\d+$/),
  // Exactly [640, 1280], in order. `buildSrcSet` sorts defensively, but the
  // catalog should never make it do so.
  widths: z.tuple([z.literal(IMAGE_WIDTHS[0]), z.literal(IMAGE_WIDTHS[1])]),
  // Intrinsic size of the LARGEST variant. Non-zero because these two
  // attributes are the entire CLS story (ADR-005).
  width: z.int().positive(),
  height: z.int().positive(),
  alt: z.string().min(1),
})

export const backpackSchema = z.object({
  rank: z.int().min(1).max(20),
  slug: z.string().regex(SLUG_RE),
  name: z.string().min(1),
  brand: z.string().min(1),
  images: z.array(carouselImageSchema).min(1).max(5),
  colorways: z.array(colorwaySchema),
  price: z.object({
    amountUsd: z.number().positive(),
    retailer: z.string().min(1),
    url: z.url(),
    capturedAt: isoInstant,
  }),
  review: z
    .object({
      score: z.number().positive(),
      scale: z.union([z.literal(5), z.literal(10)]),
      source: z.string().min(1),
      url: z.url(),
      capturedAt: isoInstant,
    })
    .refine((r) => r.score <= r.scale, {
      message: 'review.score must be <= review.scale',
      path: ['score'],
    }),
  specs: z
    .object({
      capacityLiters: z.number().positive().optional(),
      weightGrams: z.number().positive().optional(),
      dimensions: z.string().min(1).optional(),
      material: z.string().min(1).optional(),
    })
    .optional(),
})

export const catalogSchema = z.array(backpackSchema).check((ctx) => {
  const seenRank = new Map<number, string>()
  const seenSlug = new Set<string>()
  for (const pack of ctx.value) {
    const clash = seenRank.get(pack.rank)
    if (clash !== undefined) {
      ctx.issues.push({
        code: 'custom',
        input: pack,
        path: [pack.slug, 'rank'],
        message: `rank ${pack.rank} is already used by "${clash}"`,
      })
    }
    seenRank.set(pack.rank, pack.slug)

    if (seenSlug.has(pack.slug)) {
      ctx.issues.push({
        code: 'custom',
        input: pack,
        path: [pack.slug, 'slug'],
        message: `duplicate slug "${pack.slug}"`,
      })
    }
    seenSlug.add(pack.slug)
  }
})

/**
 * Compile-time proof that anything this schema accepts is a valid `Backpack`.
 * If either side drifts, this file stops type-checking — the only mechanism
 * that keeps "the zod schema and this type must never disagree" from being a
 * comment nobody enforces.
 *
 * The assertion runs **one way only**, deliberately. The schema is strictly
 * narrower than the type in one place: `CarouselImage.widths` is `number[]` in
 * the contract but `[640, 1280]` here, because the contract has to describe
 * fixtures and hand-written test data too, while the *catalog* only ever holds
 * the two widths ingest emits (ADR-005). So `schema -> Backpack` must hold and
 * `Backpack -> schema` must not; asserting the second would force the schema to
 * accept any width array, which is the invariant this file exists to enforce.
 *
 * (Type-level only; `void` keeps them from reading as unused.)
 */
type SchemaColorway = z.infer<typeof colorwaySchema>
type SchemaImage = z.infer<typeof carouselImageSchema>
type SchemaBackpack = z.infer<typeof backpackSchema>

const _schemaSatisfiesType: (v: SchemaBackpack) => Backpack = (v) => v
const _colorwaySatisfiesType: (v: SchemaColorway) => Colorway = (v) => v
const _imageSatisfiesType: (v: SchemaImage) => CarouselImage = (v) => v
/** The reverse direction *does* hold for Colorway — no narrowing there. */
const _typeSatisfiesColorway: (v: Colorway) => SchemaColorway = (v) => v
void _schemaSatisfiesType
void _colorwaySatisfiesType
void _imageSatisfiesType
void _typeSatisfiesColorway

/** One-line-per-issue rendering; a wall of zod's default output helps nobody. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`)
    .join('\n')
}
