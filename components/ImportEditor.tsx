'use client'

/* eslint-disable @next/next/no-img-element -- logo preview is a data URI. */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FieldDef, SlotId, TemplateMeta } from '@/lib/templates/types'
import { templateMetaSchema } from '@/lib/templates/schema'
import { getLayout } from '@/lib/layouts/registry'
import { classify } from '@/lib/import/classify'
import { parsePdf } from '@/lib/import/parsePdf'
import { saveCustomTemplate } from '@/lib/import/storage'
import { Preview } from './Preview'

type Stage = { step: 'drop' } | { step: 'parsing' } | { step: 'edit'; meta: TemplateMeta }

/**
 * The importer: drop a coverpage PDF, get a guessed template, correct it, save.
 * Everything runs in this browser — the PDF never leaves the machine.
 */
export function ImportEditor() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>({ step: 'drop' })
  const [dragOver, setDragOver] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setProblem('That is not a PDF. Export your coverpage as PDF and try again.')
      return
    }
    setProblem(null)
    setStage({ step: 'parsing' })
    try {
      const parsed = await parsePdf(file)
      const meta = classify(parsed.items, parsed.pageHeightMm)
      if (parsed.logo) meta.brand.logo = parsed.logo
      setStage({ step: 'edit', meta })
    } catch {
      setProblem('Could not read that PDF. If it is a scanned image, the text cannot be extracted — build the template by hand instead.')
      setStage({ step: 'drop' })
    }
  }

  if (stage.step === 'drop' || stage.step === 'parsing') {
    const parsing = stage.step === 'parsing'
    return (
      <div>
        <button
          type="button"
          disabled={parsing}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
          className={`grid min-h-[280px] w-full place-items-center rounded-[2px] border-2 border-dashed
                      p-8 text-center transition-colors ${
                        dragOver ? 'border-ink bg-sheet' : 'border-rule bg-transparent hover:border-ink'
                      }`}
        >
          <span>
            <span className="mb-2 block font-[family-name:var(--font-display)] text-lg text-ink">
              {parsing ? 'Reading your coverpage…' : 'Drop your coverpage PDF here'}
            </span>
            <span className="block text-sm">
              {parsing
                ? 'Finding the college name, the seal, and the fields you fill in.'
                : 'or click to choose a file. It is read here in your browser — never uploaded.'}
            </span>
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {problem && <p className="mt-3 text-sm text-margin">{problem}</p>}
        <p className="mt-4 text-xs">
          Works best with a PDF that has real text (exported from Word or Canva). A filled-in
          example beats a blank one — the sample values teach the importer which parts change.
        </p>
      </div>
    )
  }

  return <Editor initial={stage.meta} onSave={(meta) => {
    saveCustomTemplate(meta)
    window.localStorage.setItem('coverpage:template', JSON.stringify(meta.id))
    router.push('/')
  }} />
}

function Editor({ initial, onSave }: { initial: TemplateMeta; onSave: (meta: TemplateMeta) => void }) {
  const [meta, setMeta] = useState(initial)
  const logoInput = useRef<HTMLInputElement>(null)

  const layout = meta.layout !== 'custom' ? getLayout(meta.layout) : undefined
  const validation = templateMetaSchema.safeParse(meta)

  const setBrand = (patch: Partial<TemplateMeta['brand']>) =>
    setMeta((m) => ({ ...m, brand: { ...m.brand, ...patch } }))
  const setField = (i: number, patch: Partial<FieldDef>) =>
    setMeta((m) => ({ ...m, fields: m.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }))
  const removeField = (i: number) =>
    setMeta((m) => ({ ...m, fields: m.fields.filter((_, j) => j !== i) }))
  const addField = () =>
    setMeta((m) => ({
      ...m,
      fields: [...m.fields, {
        key: `field${m.fields.length + 1}`, label: 'New field', slot: 'details',
        type: 'text', required: false, maxLength: 40,
      }],
    }))

  async function replaceLogo(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBrand({ logo: String(reader.result) })
    reader.readAsDataURL(file)
  }

  // Sample values so the preview shows placeholders meaningfully.
  const sample = Object.fromEntries(meta.fields.map((f) => [f.key, f.placeholder ?? '']))

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(320px,440px)_1fr]">
      <div className="flex flex-col gap-6">
        <section className="ruled-card p-5 pl-12">
          <h2 className="mb-3 text-base">College header</h2>
          <p className="mb-3 text-xs">Printed the same on every copy.</p>
          {meta.brand.institution.map((line, i) => (
            <input key={i} className="field-input mb-2" value={line}
              aria-label={`Institution line ${i + 1}`}
              onChange={(e) => setBrand({
                institution: meta.brand.institution.map((l, j) => (j === i ? e.target.value : l)),
              })} />
          ))}
          <div className="mb-2 flex gap-2">
            {meta.brand.institution.length < 3 && (
              <button type="button" className="btn-ghost"
                onClick={() => setBrand({ institution: [...meta.brand.institution, ''] })}>
                Add line
              </button>
            )}
            {meta.brand.institution.length > 1 && (
              <button type="button" className="btn-ghost"
                onClick={() => setBrand({ institution: meta.brand.institution.slice(0, -1) })}>
                Remove line
              </button>
            )}
          </div>
          <input className="field-input mb-3" placeholder="Address (optional)"
            aria-label="Address" value={meta.brand.address ?? ''}
            onChange={(e) => setBrand({ address: e.target.value || undefined })} />

          <div className="flex items-center gap-3">
            {meta.brand.logo ? (
              <img src={meta.brand.logo} alt="College seal" className="h-14 w-14 border border-rule object-contain" />
            ) : (
              <span className="grid h-14 w-14 place-items-center border border-dashed border-rule text-[0.6rem]">
                no seal
              </span>
            )}
            <button type="button" className="btn-ghost" onClick={() => logoInput.current?.click()}>
              {meta.brand.logo ? 'Replace seal' : 'Add seal image'}
            </button>
            <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp"
              className="hidden" onChange={(e) => replaceLogo(e.target.files?.[0])} />
          </div>
        </section>

        <section className="ruled-card p-5 pl-12">
          <h2 className="mb-1 text-base">Fields you fill in</h2>
          <p className="mb-3 text-xs">These become the form. Everything else stays fixed.</p>

          <div className="flex flex-col gap-3">
            {meta.fields.map((f, i) => (
              <div key={i} className="rounded-[2px] border border-rule bg-sheet p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input className="field-input" value={f.label} aria-label="Field label"
                    onChange={(e) => setField(i, { label: e.target.value })} />
                  <button type="button" aria-label={`Remove ${f.label}`}
                    className="shrink-0 text-sm text-pencil hover:text-margin"
                    onClick={() => removeField(i)}>
                    ✕
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select className="field-input !w-auto" value={f.slot} aria-label="Position"
                    onChange={(e) => setField(i, { slot: e.target.value as SlotId })}>
                    <option value="title">Big title</option>
                    <option value="subtitle">Subtitle</option>
                    <option value="details">Details row</option>
                  </select>
                  <select className="field-input !w-auto" value={f.type} aria-label="Input type"
                    onChange={(e) => setField(i, {
                      type: e.target.value as FieldDef['type'],
                      options: e.target.value === 'select' ? (f.options ?? ['Option 1']) : undefined,
                    })}>
                    <option value="text">Text</option>
                    <option value="select">Dropdown</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                  </select>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={f.required ?? false}
                      onChange={(e) => setField(i, { required: e.target.checked })} />
                    Required
                  </label>
                </div>
                {f.type === 'select' && (
                  <input className="field-input mt-2" aria-label="Dropdown options"
                    placeholder="Options, comma separated"
                    value={(f.options ?? []).join(', ')}
                    onChange={(e) => setField(i, {
                      options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })} />
                )}
              </div>
            ))}
          </div>

          <button type="button" className="btn-ghost mt-3" onClick={addField}>
            Add a field
          </button>
        </section>

        <section className="ruled-card p-5 pl-12">
          <h2 className="mb-3 text-base">Save</h2>
          <input className="field-input mb-3" aria-label="Template name" value={meta.name}
            onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))} />
          <button type="button" className="btn-ink w-full" disabled={!validation.success}
            onClick={() => onSave(meta)}>
            Save template
          </button>
          {!validation.success && (
            <p className="mt-2 text-xs text-margin">
              {validation.error.issues[0]?.message ?? 'Fix the highlighted fields to save.'}
            </p>
          )}
          <p className="mt-2 text-xs">
            Saved in this browser only — it appears on your template shelf, ready to use.
          </p>
        </section>
      </div>

      <div className="min-w-0 lg:sticky lg:top-8">
        <h2 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-pencil">
          Preview — updates as you edit
        </h2>
        {layout && validation.success ? (
          <Preview>
            <layout.Component brand={meta.brand} fields={meta.fields} values={sample} />
          </Preview>
        ) : (
          <p className="text-sm">The preview returns once the template is valid.</p>
        )}
      </div>
    </div>
  )
}
