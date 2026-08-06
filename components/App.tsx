'use client'

import { useState } from 'react'
import type { TemplateMeta, TemplateValues } from '@/lib/templates/types'
import { DynamicForm, isComplete } from './DynamicForm'
import { Preview } from './Preview'
import { TemplatePicker } from './TemplatePicker'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { getTemplate } from '@/lib/templates/registry'

/**
 * The whole client app. One values object is shared across templates, so
 * switching templates keeps any field the new template also defines —
 * name/roll/branch carry over for free.
 */
export function App({ templates }: { templates: TemplateMeta[] }) {
  const [templateId, setTemplateId] = useLocalStorage('coverpage:template', templates[0]?.id ?? '')
  const [values, setValues] = useLocalStorage<TemplateValues>('coverpage:values', {})
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolved = getTemplate(templateId) ?? getTemplate(templates[0]?.id ?? '')
  if (!resolved) return null
  const { meta, Component } = resolved

  const complete = isComplete(meta.fields, values)

  async function download() {
    setDownloading(true)
    setError(null)
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: meta.id, values }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(values.name ?? 'coverpage').replace(/[^\w-]+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Coverpage Maker</h1>
        <p className="text-sm text-neutral-500">
          Pick a template, fill in your details, download a print-ready PDF.
        </p>
      </header>

      <TemplatePicker templates={templates} selectedId={meta.id} onSelect={setTemplateId} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(260px,380px)_1fr]">
        <section>
          <DynamicForm fields={meta.fields} values={values} onChange={setValues} />

          <button
            type="button"
            onClick={download}
            disabled={!complete || downloading}
            className="mt-6 w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-semibold
                       text-white transition-opacity disabled:opacity-40 dark:bg-neutral-100
                       dark:text-neutral-900"
          >
            {downloading ? 'Generating PDF…' : 'Download PDF'}
          </button>

          {!complete && (
            <p className="mt-2 text-xs text-neutral-500">Fill the required fields (*) to download.</p>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-600">
              {error} — you can also print the preview with Ctrl+P.
            </p>
          )}
        </section>

        <section className="min-w-0">
          <Preview>
            <Component brand={meta.brand} fields={meta.fields} values={values} />
          </Preview>
        </section>
      </div>

      {/* Unscaled copy used only by Ctrl+P — the fallback when /api/render fails. */}
      <div className="print-only" aria-hidden>
        <Component brand={meta.brand} fields={meta.fields} values={values} />
      </div>
    </div>
  )
}
