import type { TemplateComponent, TemplateMeta } from './types'

export interface RegisteredTemplate {
  meta: TemplateMeta
  Component: TemplateComponent
}

/**
 * Every template known to the app.
 *
 * Static imports on purpose: they keep the registry type-checked and let the
 * bundler include template assets. Scanning the filesystem at runtime would
 * not work on a serverless host, where only traced files are deployed.
 *
 * To add a template, create lib/templates/<id>/ with template.json and
 * Template.tsx, then add one entry here.
 */
const templates: RegisteredTemplate[] = [
  // { meta: sambalpurLabMeta, Component: SambalpurLab },
]

const byId = new Map(templates.map((t) => [t.meta.id, t]))

export function listTemplates(): TemplateMeta[] {
  return templates.map((t) => t.meta)
}

export function getTemplate(id: string): RegisteredTemplate | undefined {
  return byId.get(id)
}
