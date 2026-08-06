import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTemplate, type ResolvedTemplate } from '@/lib/templates/registry'
import { getLayout } from '@/lib/layouts/registry'
import { templateMetaSchema, valuesSchemaFor } from '@/lib/templates/schema'
import type { TemplateMeta } from '@/lib/templates/types'
import { buildHtml } from '@/lib/pdf/render'
import { getBrowser } from '@/lib/pdf/browser'

export const runtime = 'nodejs'
export const maxDuration = 30

const bodySchema = z.object({
  templateId: z.string().optional(),
  // Imported templates live only in the sender's browser, so their definition
  // travels with the request instead of a registry id.
  meta: z.unknown().optional(),
  values: z.record(z.string(), z.string()),
})

/** POST { templateId | meta, values } → application/pdf */
export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Malformed request body' }, { status: 400 })
  }
  const { templateId, meta, values } = parsedBody.data

  let template: ResolvedTemplate | undefined
  if (templateId) {
    template = getTemplate(templateId)
    if (!template) {
      return NextResponse.json({ error: `Unknown template '${templateId}'` }, { status: 400 })
    }
  } else {
    // Inline meta is client input — full schema validation, and it must name a
    // shared layout ('custom' means arbitrary code, which a request cannot ship).
    const parsedMeta = templateMetaSchema.safeParse(meta)
    if (!parsedMeta.success) {
      return NextResponse.json({ error: 'Invalid template definition' }, { status: 400 })
    }
    const layout = parsedMeta.data.layout !== 'custom' ? getLayout(parsedMeta.data.layout) : undefined
    if (!layout) {
      return NextResponse.json({ error: 'Template must use a shared layout' }, { status: 400 })
    }
    template = { meta: parsedMeta.data as TemplateMeta, Component: layout.Component }
  }

  // Defence in depth: the UI disables download until required fields are
  // filled, but the route never trusts the client.
  const parsedValues = valuesSchemaFor(template.meta.fields).safeParse(values)
  if (!parsedValues.success) {
    const fields = [...new Set(parsedValues.error.issues.map((i) => String(i.path[0])))]
    return NextResponse.json(
      { error: `Invalid or missing fields: ${fields.join(', ')}` },
      { status: 400 },
    )
  }

  const data = parsedValues.data as Record<string, string>

  try {
    const html = await buildHtml(template, data)

    const browser = await getBrowser()
    const page = await browser.newPage()
    try {
      // 'load' is enough: the document is self-contained (inline CSS, data-URI
      // images), so there is no network activity to go idle.
      await page.setContent(html, { waitUntil: 'load' })
      // Data-URI fonts still decode asynchronously; print before this resolves
      // and text falls back to a default serif.
      await page.evaluateHandle('document.fonts.ready')
      // printBackground keeps borders and fills; without it they silently vanish.
      const pdf = await page.pdf({ format: 'A4', printBackground: true })

      const name = (data.name ?? 'coverpage').replace(/[^\w-]+/g, '_') || 'coverpage'
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${name}.pdf"`,
        },
      })
    } finally {
      // Close the page, keep the browser for the next warm invocation.
      await page.close().catch(() => {})
    }
  } catch (err) {
    console.error('PDF render failed:', err)
    return NextResponse.json(
      { error: 'PDF generation failed. Use Ctrl+P on the preview as a fallback.' },
      { status: 500 },
    )
  }
}
