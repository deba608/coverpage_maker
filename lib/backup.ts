'use client'

import { z } from 'zod'
import type { TemplateMeta, TemplateValues } from '@/lib/templates/types'
import { templateMetaSchema } from '@/lib/templates/schema'
import { listCustomTemplates, saveCustomTemplate } from '@/lib/import/storage'
import type { OverridesByTemplate } from '@/lib/customize'

/**
 * Everything this browser knows, as one portable JSON file: imported
 * templates, per-template customizations, and the form values. Lets a user
 * move machines or survive a cleared localStorage.
 */

const backupSchema = z.object({
  app: z.literal('coverpage-maker'),
  version: z.literal(1),
  customTemplates: z.array(z.unknown()),
  overrides: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  values: z.record(z.string(), z.string()).optional(),
})

export function buildBackup(overrides: OverridesByTemplate, values: TemplateValues): Blob {
  const payload = {
    app: 'coverpage-maker',
    version: 1,
    customTemplates: listCustomTemplates(),
    overrides,
    values,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

export interface RestoredBackup {
  templates: TemplateMeta[]
  /** Templates that parsed but could not be written to browser storage. */
  failedSaves: number
  overrides: OverridesByTemplate
  values: TemplateValues
}

/**
 * Validates and applies a backup file. Templates are re-validated one by one —
 * a hand-edited or truncated entry is skipped, not fatal. Returns what was
 * restored so the caller can merge it into React state.
 */
export function restoreBackup(text: string): RestoredBackup {
  const parsed = backupSchema.safeParse(JSON.parse(text))
  if (!parsed.success) throw new Error('Not a Coverpage Maker backup file')

  const templates: TemplateMeta[] = []
  let failedSaves = 0
  for (const raw of parsed.data.customTemplates) {
    const t = templateMetaSchema.safeParse(raw)
    if (t.success && saveCustomTemplate(t.data as TemplateMeta)) {
      templates.push(t.data as TemplateMeta)
    } else if (t.success) {
      failedSaves++
    }
  }
  return {
    templates,
    failedSaves,
    overrides: (parsed.data.overrides ?? {}) as OverridesByTemplate,
    values: parsed.data.values ?? {},
  }
}
