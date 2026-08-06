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

/** Logos are inlined as data URIs so Chromium never makes a network request. */
async function inlineLogo(logoPath: string | undefined): Promise<string | undefined> {
  if (!logoPath) return undefined
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
  values: TemplateValues,
): Promise<string> {
  const { meta, Component } = template

  const cssPath = LAYOUT_CSS[meta.layout]
  const css = cssPath ? await readFile(join(process.cwd(), cssPath), 'utf8') : ''

  const brand = { ...meta.brand, logo: await inlineLogo(meta.brand.logo) }
  const body = renderToStaticMarkup(
    Component({ brand, fields: meta.fields, values }),
  )

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; }
  @page { size: A4; margin: 0; }
  ${css}
</style>
</head>
<body>${body}</body>
</html>`
}
