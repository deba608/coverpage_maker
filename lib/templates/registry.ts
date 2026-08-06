import type { LayoutComponent, TemplateMeta } from './types'
import { getLayout } from '@/lib/layouts/registry'

export interface RegisteredTemplate {
  meta: TemplateMeta
  /** Supplied only when `meta.layout` is 'custom'; otherwise resolved from the layout registry. */
  CustomComponent?: LayoutComponent
}

/**
 * Every template known to the app.
 *
 * Static imports on purpose: they keep the registry type-checked and let the
 * bundler trace template assets. Scanning the filesystem at runtime would not
 * work on a serverless host, where only traced files are deployed.
 *
 * To add a template, create lib/templates/<id>/template.json (plus a logo) and
 * add one entry here. No component, no CSS.
 */
const templates: RegisteredTemplate[] = [
  // { meta: sambalpurLab as TemplateMeta },
]

const byId = new Map(templates.map((t) => [t.meta.id, t]))

export function listTemplates(): TemplateMeta[] {
  return templates.map((t) => t.meta)
}

export interface ResolvedTemplate {
  meta: TemplateMeta
  Component: LayoutComponent
}

/**
 * Looks up a template and the component that renders it, resolving `layout`
 * through the layout registry. Returns undefined for an unknown id, or for a
 * template whose layout is missing — the schema test makes the latter a CI
 * failure rather than something a user can hit.
 */
export function getTemplate(id: string): ResolvedTemplate | undefined {
  const entry = byId.get(id)
  if (!entry) return undefined

  if (entry.meta.layout === 'custom') {
    return entry.CustomComponent
      ? { meta: entry.meta, Component: entry.CustomComponent }
      : undefined
  }

  const layout = getLayout(entry.meta.layout)
  return layout ? { meta: entry.meta, Component: layout.Component } : undefined
}

/** Raw registry entries, for tests that need to inspect `custom` templates. */
export function registryEntries(): readonly RegisteredTemplate[] {
  return templates
}
