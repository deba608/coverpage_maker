'use client'

import type { TemplateMeta } from '@/lib/templates/types'
import { templateMetaSchema } from '@/lib/templates/schema'

/**
 * Imported templates live only in this browser. localStorage keeps them across
 * visits; nothing is uploaded anywhere until the user generates a PDF, at
 * which point the definition rides along in that one request.
 */
const KEY = 'coverpage:customTemplates'

export function listCustomTemplates(): TemplateMeta[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Re-validate on read: a stale or hand-edited entry must not crash the app.
    return parsed.flatMap((t) => {
      const result = templateMetaSchema.safeParse(t)
      return result.success ? [result.data as TemplateMeta] : []
    })
  } catch {
    return []
  }
}

export function saveCustomTemplate(meta: TemplateMeta): void {
  const rest = listCustomTemplates().filter((t) => t.id !== meta.id)
  window.localStorage.setItem(KEY, JSON.stringify([...rest, meta]))
}

export function deleteCustomTemplate(id: string): void {
  window.localStorage.setItem(KEY, JSON.stringify(listCustomTemplates().filter((t) => t.id !== id)))
}
