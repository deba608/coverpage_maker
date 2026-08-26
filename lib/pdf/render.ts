import 'server-only'
import { readFile } from 'node:fs/promises'
import { extname, join, sep } from 'node:path'
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
 * Fixed repo assets are read once per process — the lambda reuses the module
 * across warm invocations, and the preview path hits these on every render.
 * Failed reads evict their promise so a transient fs error can retry.
 */
const textCache = new Map<string, Promise<string>>()
const binaryCache = new Map<string, Promise<Buffer>>()

function readTextCached(relPath: string): Promise<string> {
  let p = textCache.get(relPath)
  if (!p) {
    p = readFile(join(process.cwd(), relPath), 'utf8').catch((err) => {
      textCache.delete(relPath)
      throw err
    })
    textCache.set(relPath, p)
  }
  return p
}

function readBinaryCached(relPath: string): Promise<Buffer> {
  let p = binaryCache.get(relPath)
  if (!p) {
    p = readFile(join(process.cwd(), relPath)).catch((err) => {
      binaryCache.delete(relPath)
      throw err
    })
    binaryCache.set(relPath, p)
  }
  return p
}

/**
 * Self-hosted fonts, embedded as data URIs so the PDF's Chromium shapes text
 * with exactly the glyphs the preview used. The lambda has no MS fonts; without
 * this, 'Times New Roman' silently falls back and the geometry drifts.
 */
async function buildFontFaces(): Promise<string> {
  const faces = [
    { file: 'tinos-latin-400-normal.woff2', weight: 400 },
    { file: 'tinos-latin-700-normal.woff2', weight: 700 },
  ]
  const rules = await Promise.all(
    faces.map(async ({ file, weight }) => {
      const data = await readBinaryCached(join('public', 'fonts', file))
      return `@font-face {
  font-family: 'Tinos';
  src: url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');
  font-weight: ${weight};
}`
    }),
  )
  return rules.join('\n')
}

let facesPromise: Promise<string> | undefined
function fontFaces(): Promise<string> {
  // The composed @font-face block is pure output of immutable files — build it once.
  return (facesPromise ??= buildFontFaces())
}

/** Logos are inlined as data URIs so Chromium never makes a network request. */
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

const PUBLIC_ROOT = join(process.cwd(), 'public')

async function inlineLogo(logoPath: string | undefined): Promise<string | undefined> {
  if (!logoPath) return undefined
  // Imported templates already carry their logo inline.
  if (logoPath.startsWith('data:')) return logoPath
  // assetRef only checks the leading '/', so the read must be confined to
  // /public and a known image extension — otherwise a hostile inline meta
  // with logo: "/../../.env" would read arbitrary files into the PDF.
  const abs = join(PUBLIC_ROOT, logoPath)
  const mime = MIME_BY_EXT[extname(abs).toLowerCase()]
  if (!mime || !abs.startsWith(PUBLIC_ROOT + sep)) return undefined
  const file = await readFile(abs)
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
  const css = cssPath ? await readTextCached(cssPath) : ''

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
