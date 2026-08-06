'use client'

import { useEffect, useRef, useState } from 'react'
import type { LayoutComponent, TemplateMeta, TemplateValues } from '@/lib/templates/types'
import { DynamicForm, isComplete } from './DynamicForm'
import { Preview } from './Preview'
import { TemplatePicker } from './TemplatePicker'
import { CustomizePanel } from './CustomizePanel'
import { BulkPanel } from './BulkPanel'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { applyOverrides, hasOverrides, type OverridesByTemplate } from '@/lib/customize'
import { getTemplate } from '@/lib/templates/registry'
import { getLayout } from '@/lib/layouts/registry'
import { deleteCustomTemplate, listCustomTemplates, saveCustomTemplate } from '@/lib/import/storage'
import { buildBackup, restoreBackup } from '@/lib/backup'
import { buildShareUrl, clearShareHash, readSharedTemplate } from '@/lib/share'

/**
 * The whole client app. One values object is shared across templates, so
 * switching templates keeps any field the new template also defines —
 * name/roll/branch carry over for free.
 *
 * Imported templates come from this browser's localStorage; downloading one
 * sends its definition inline to /api/render instead of a registry id.
 */
export function App({ templates }: { templates: TemplateMeta[] }) {
  const [customTemplates, setCustomTemplates] = useState<TemplateMeta[]>([])
  const [templateId, setTemplateId] = useLocalStorage('coverpage:template', templates[0]?.id ?? '')
  const [values, setValues] = useLocalStorage<TemplateValues>('coverpage:values', {})
  const [overridesById, setOverridesById] = useLocalStorage<OverridesByTemplate>(
    'coverpage:overrides',
    {},
  )
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const restoreRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Deliberate one-time post-mount read — localStorage does not exist on the
    // server, and reading it during render would break hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomTemplates(listCustomTemplates())

    // Share links carry a template in the URL fragment. Ask before adopting —
    // a link is untrusted input even after schema validation.
    const shared = readSharedTemplate()
    if (shared && window.confirm(`Add the shared template "${shared.name}"?`)) {
      saveCustomTemplate(shared)
      setCustomTemplates(listCustomTemplates())
      setTemplateId(shared.id)
    }
    if (shared) clearShareHash()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only intake
  }, [])

  const all = [...templates, ...customTemplates]
  const customIds = new Set(customTemplates.map((t) => t.id))

  const resolved = resolve(templateId) ?? resolve(templates[0]?.id ?? '')
  function resolve(id: string): { meta: TemplateMeta; Component: LayoutComponent } | undefined {
    const builtin = getTemplate(id)
    if (builtin) return builtin
    const custom = customTemplates.find((t) => t.id === id)
    if (!custom || custom.layout === 'custom') return undefined
    const layout = getLayout(custom.layout)
    return layout ? { meta: custom, Component: layout.Component } : undefined
  }
  if (!resolved) return null
  const { meta: baseMeta, Component } = resolved

  const overrides = overridesById[baseMeta.id] ?? {}
  // Everything below — preview, print copy, single and bulk downloads — sees
  // the same customized meta, so what you see is always what prints.
  const meta = applyOverrides(baseMeta, overrides)

  const complete = isComplete(meta.fields, values)

  function setOverrides(next: (typeof overridesById)[string]) {
    setOverridesById({ ...overridesById, [baseMeta.id]: next })
  }

  // Overridden templates must travel inline: the registry copy on the server
  // doesn't know about this browser's customizations. Callers add `values`
  // (single) or `rows` (merged bulk) on top.
  function buildRequestBase(): object {
    return customIds.has(meta.id) || hasOverrides(overrides)
      ? { meta }
      : { templateId: meta.id }
  }

  function exportBackup() {
    const blob = buildBackup(overridesById, values)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'coverpage-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importBackup(file: File | undefined) {
    if (!file) return
    setNotice(null)
    try {
      const restored = restoreBackup(await file.text())
      setCustomTemplates(listCustomTemplates())
      setOverridesById({ ...overridesById, ...restored.overrides })
      setValues({ ...values, ...restored.values })
      setNotice(
        `Backup restored: ${restored.templates.length} template${
          restored.templates.length === 1 ? '' : 's'
        }, settings, and form values.`,
      )
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not read that backup file')
    } finally {
      if (restoreRef.current) restoreRef.current.value = ''
    }
  }

  async function shareCurrent() {
    const { url, logoStripped } = buildShareUrl(meta)
    await navigator.clipboard.writeText(url)
    setNotice(
      logoStripped
        ? 'Share link copied. The seal image was too large to fit in a link — the recipient adds their own.'
        : 'Share link copied to the clipboard.',
    )
  }

  function removeCustom(id: string) {
    deleteCustomTemplate(id)
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id))
    if (templateId === id) setTemplateId(templates[0]?.id ?? '')
  }

  async function download() {
    setDownloading(true)
    setError(null)
    try {
      const body = { ...buildRequestBase(), values }
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="name-slip">
            <h1 className="text-xl leading-tight sm:text-2xl">Coverpage Maker</h1>
          </div>
          <p className="mt-2 text-sm">
            Fill in your details, download the A4 PDF, staple it on top.
          </p>
        </div>
      </header>

      <section aria-label="Templates" className="mb-6">
        <h2 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-pencil">
          Templates
        </h2>
        <TemplatePicker
          templates={all}
          customIds={customIds}
          selectedId={meta.id}
          onSelect={setTemplateId}
          onDelete={removeCustom}
        />
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(280px,400px)_1fr]">
        <section aria-label="Your details" className="ruled-card p-6 pl-14">
          <h2 className="mb-4 text-base">Your details</h2>
          <DynamicForm fields={meta.fields} values={values} onChange={setValues} />

          <button type="button" onClick={download} disabled={!complete || downloading}
            className="btn-ink mt-6 w-full">
            {downloading ? 'Preparing your PDF…' : 'Download PDF'}
          </button>

          {!complete && (
            <p className="mt-2 text-xs">
              Fields marked <span className="font-semibold text-margin">*</span> are needed for the
              download.
            </p>
          )}
          {error && (
            <p className="mt-2 text-xs text-margin">
              {error} You can also print this page with Ctrl+P — the preview prints as the full
              A4 sheet.
            </p>
          )}

          <CustomizePanel brand={baseMeta.brand} overrides={overrides} onChange={setOverrides} />
          <BulkPanel meta={meta} buildRequestBody={buildRequestBody} />
        </section>

        <section aria-label="Preview" className="min-w-0 lg:sticky lg:top-8">
          <h2 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-pencil">
            Preview — updates as you type
          </h2>
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
