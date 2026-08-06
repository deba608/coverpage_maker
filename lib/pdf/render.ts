import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
// Next refuses a static 'react-dom/server' import in app code (it assumes the
// SSR-inside-SSR footgun). This is the sanctioned escape: the .edge build
// carries the same legacy renderToStaticMarkup and is not blocked. Rendering a
// layout to a string here is the whole point — the string goes to Chromium,
// not to the response.
import { renderToStaticMarkup } from 'react-dom/server.edge'
import type { ResolvedTemplate } from '@/lib/templates/registry'
import type { TemplateValues } from '@/lib/templates/types'

/**
 * Layout CSS for the PDF path.
 *
 * In the app the CSS travels through the Next build; Chromium's setContent
 * sees none of that, so the raw file is read from disk and inlined. Paths are
 * listed here (not derived) so the file trace can include them on Vercel.
 */
const LAYOUT_CSS: Record<string, string> = {
  'classic-seal': 'lib/layouts/classic-seal/classic-seal.css',
}

/**
 * Self-hosted fonts, embedded as data URIs so the PDF's Chromium shapes text
 * with exactly the glyphs the preview used. The lambda has no MS fonts; without
 * this, 'Times New Roman' silently falls back and the geometry drifts.
 */
async function fontFaces(): Promise<string> {
  const faces = [
    { file: 'tinos-latin-400-normal.woff2', weight: 400 },
    { file: 'tinos-latin-700-normal.woff2', weight: 700 },
  ]
  const rules = await Promise.all(
    faces.map(async ({ file, weight }) => {
      const data = await readFile(join(process.cwd(), 'public', 'fonts', file))
      return `@font-face {
  font-family: 'Tinos';
  src: url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');
  font-weight: ${weight};
}`
    }),
  )
  return rules.join('\n')
}

/** Logos are inlined as data URIs so Chromium never makes a network request. */
async function inlineLogo(logoPath: string | undefined): Promise<string | undefined> {
  if (!logoPath) return undefined
  // Imported templates already carry their logo inline.
  if (logoPath.startsWith('data:')) return logoPath
  const file = await readFile(join(process.cwd(), 'public', logoPath))
  const mime = logoPath.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
  return `data:${mime};base64,${file.toString('base64')}`
}

/**
 * Renders a template to a self-contained HTML document: layout CSS in a
 * <style> tag, logo as a data URI, no external references at all. What
 * Chromium gets is exactly what the preview rendered, minus the app around it.
 */
export async function buildHtml(
  template: ResolvedTemplate,
  values: TemplateValues | TemplateValues[],
): Promise<string> {
  const { meta, Component } = template

  const cssPath = LAYOUT_CSS[meta.layout]
  const css = cssPath ? await readFile(join(process.cwd(), cssPath), 'utf8') : ''

  const brand = { ...meta.brand, logo: await inlineLogo(meta.brand.logo) }
  // Several value sets → several .cs-page roots in one document. Each root is
  // exactly 297mm tall, so Chromium paginates them 1:1 onto A4 pages — the
  // "whole class in one PDF" path costs one render, not N.
  const rows = Array.isArray(values) ? values : [values]
  const body = rows
    .map((v) => renderToStaticMarkup(Component({ brand, fields: meta.fields, values: v })))
    .join('')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; }
  @page { size: A4; margin: 0; }
  ${await fontFaces()}
  ${css}
</style>
</head>
<body>${body}</body>
</html>`
}
