import { z } from 'zod'

/**
 * Runtime mirror of the interfaces in ./types.ts.
 *
 * Two jobs: validating template.json files in CI (so a hand-written template
 * fails the build rather than the page), and validating the values posted to
 * /api/render (so the render route never trusts the client).
 *
 * The first job is what makes JSON-only template authoring safe.
 */

export const slotIdSchema = z.enum(['title', 'subtitle', 'details'])

export const fieldDefSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(['text', 'select', 'number', 'date']),
    slot: slotIdSchema,
    required: z.boolean().optional(),
    options: z.array(z.string().min(1)).min(1).optional(),
    placeholder: z.string().optional(),
    maxLength: z.number().int().positive().optional(),
  })
  .refine((f) => f.type !== 'select' || (f.options?.length ?? 0) > 0, {
    message: "a field of type 'select' must define options",
    path: ['options'],
  })

/**
 * Repo templates reference assets under /public; imported templates carry them
 * inline as data URIs (they live in the user's browser, not the repo). The cap
 * keeps a hostile payload from inflating the render lambda's memory.
 */
const assetRef = z
  .string()
  .max(1_000_000)
  .refine(
    (s) => s.startsWith('/') || /^data:image\/(png|jpeg|webp);base64,/.test(s),
    'must be a /public path or a png/jpeg/webp data URI',
  )

export const brandConfigSchema = z.object({
  institution: z.array(z.string().min(1).max(80)).min(1).max(3),
  address: z.string().max(120).optional(),
  logo: assetRef.optional(),
  logoWidthMm: z.number().positive().max(200).optional(),
  font: z.enum(['serif', 'sans', 'times', 'garamond']),
  border: z.enum(['double', 'single', 'none']),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'accentColor must be a 6-digit hex colour')
    .optional(),
  borderInsetMm: z.number().min(2).max(25).optional(),
})

export const layoutIdSchema = z.enum(['classic-seal', 'custom'])

export const templateMetaSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id must be lowercase kebab-case'),
    name: z.string().min(1),
    description: z.string().min(1),
    thumbnail: assetRef,
    layout: layoutIdSchema,
    brand: brandConfigSchema,
    fields: z.array(fieldDefSchema).min(1),
  })
  .refine((t) => new Set(t.fields.map((f) => f.key)).size === t.fields.length, {
    message: 'field keys must be unique within a template',
    path: ['fields'],
  })
  .refine((t) => t.fields.filter((f) => f.slot === 'title').length <= 1, {
    message: "the 'title' slot holds at most one field",
    path: ['fields'],
  })
  .refine((t) => t.fields.filter((f) => f.slot === 'subtitle').length <= 1, {
    message: "the 'subtitle' slot holds at most one field",
    path: ['fields'],
  })

export type ParsedFieldDef = z.infer<typeof fieldDefSchema>

/**
 * Builds a validator for one template's submitted values.
 *
 * Required fields must be non-empty; select fields must hold one of their
 * declared options; everything is trimmed and length-capped so a careless or
 * hostile value can never break the page geometry.
 */
export function valuesSchemaFor(fields: readonly ParsedFieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of fields) {
    const base: z.ZodTypeAny =
      field.type === 'select' && field.options
        ? z.enum(field.options as [string, ...string[]])
        : z.string().trim().max(field.maxLength ?? 200)

    shape[field.key] = field.required
      ? field.type === 'select'
        ? base
        : (base as z.ZodString).min(1, `${field.label} is required`)
      : base.optional().or(z.literal(''))
  }

  // Unknown keys are dropped rather than rejected, so a stale client that still
  // posts a removed field keeps working.
  return z.object(shape).strip()
}
