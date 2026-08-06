import { z } from 'zod'

/**
 * Runtime mirror of the interfaces in ./types.ts.
 *
 * Two jobs: validating template.json files in CI (so a malformed template
 * fails the build rather than the page), and validating the values posted to
 * /api/render (so the render route never trusts the client).
 */

export const fieldDefSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(['text', 'select', 'number', 'date']),
    required: z.boolean().optional(),
    options: z.array(z.string().min(1)).min(1).optional(),
    placeholder: z.string().optional(),
    maxLength: z.number().int().positive().optional(),
  })
  .refine((f) => f.type !== 'select' || (f.options?.length ?? 0) > 0, {
    message: "a field of type 'select' must define options",
    path: ['options'],
  })

export const templateMetaSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'id must be lowercase kebab-case'),
    name: z.string().min(1),
    description: z.string().min(1),
    thumbnail: z.string().startsWith('/'),
    fields: z.array(fieldDefSchema).min(1),
  })
  .refine(
    (t) => new Set(t.fields.map((f) => f.key)).size === t.fields.length,
    { message: 'field keys must be unique within a template', path: ['fields'] },
  )

/**
 * Builds a validator for one template's submitted values.
 *
 * Required fields must be non-empty; select fields must hold one of their
 * declared options; everything is trimmed and length-capped so a hostile or
 * careless value can never break the page geometry.
 */
export function valuesSchemaFor(fields: readonly z.infer<typeof fieldDefSchema>[]) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of fields) {
    let value: z.ZodTypeAny =
      field.type === 'select' && field.options
        ? z.enum(field.options as [string, ...string[]])
        : z.string().trim().max(field.maxLength ?? 200)

    if (field.required) {
      if (field.type !== 'select') value = (value as z.ZodString).min(1, `${field.label} is required`)
    } else {
      value = value.optional().or(z.literal(''))
    }

    shape[field.key] = value
  }

  // Unknown keys are dropped rather than rejected, so a stale client that
  // still posts a removed field keeps working.
  return z.object(shape).strip()
}
