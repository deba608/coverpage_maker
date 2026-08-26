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

/**
 * Persists a template. Returns false instead of throwing when the browser
 * refuses (private mode, quota) — callers surface that as a notice.
 */
export function saveCustomTemplate(meta: TemplateMeta): boolean {
  const rest = listCustomTemplates().filter((t) => t.id !== meta.id)
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...rest, meta]))
    return true
  } catch {
    return false
  }
}

export function deleteCustomTemplate(id: string): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(listCustomTemplates().filter((t) => t.id !== id)))
    return true
  } catch {
    return false
  }
}
