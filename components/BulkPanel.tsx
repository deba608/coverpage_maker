'use client'

import { useRef, useState } from 'react'
import type { FieldDef, TemplateMeta, TemplateValues } from '@/lib/templates/types'
import {
  buildTemplateCsv,
  matchCsv,
  parseDelimited,
  type BulkRow,
  type MatchResult,
} from '@/lib/bulk/csv'
import { readClassList } from '@/lib/bulk/fileReader'
import { ZipWriter } from '@/lib/bulk/zip'

/** Render route cap for merged PDF pages. */
const MERGE_LIMIT = 200

/** Parallel fetches per ZIP run — bounded so the lambda's one browser isn't hammered. */
const ZIP_CONCURRENCY = 5

/**
 * Whole-class mode: get the rows in (CSV file or a straight paste from
 * Excel/Sheets), validate them, and generate either a ZIP of per-student PDFs
 * or one merged PDF in row order.
 *
 * Fields the sheet doesn't have take the form's current value for every row —
 * the form is where the class constants (Lab Name, Semester…) live, the sheet
 * holds only what varies per student.
 */
export function BulkPanel({
  meta,
  formValues,
  buildRequestBase,
}: {
  meta: TemplateMeta
  formValues: TemplateValues
  buildRequestBase: () => object
}) {
  const [open, setOpen] = useState(false)
  const [matched, setMatched] = useState<MatchResult | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [output, setOutput] = useState<'zip' | 'merged'>('zip')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cancelled = useRef(false)

  const rows = matched?.rows ?? []
  const valid = rows.filter((r) => r.errors.length === 0)
  const invalid = rows.filter((r) => r.errors.length > 0)
  const generating = progress !== null
  const mergedAllowed = valid.length <= MERGE_LIMIT

  function downloadTemplateCsv() {
    const blob = new Blob([buildTemplateCsv(meta.fields)], { type: 'text/csv' })
    triggerDownload(blob, `${meta.id}-class-list.csv`)
  }

  function ingest(rows: string[][], name: string) {
    setSourceName(name)
    setMatched(matchCsv(rows, meta.fields, formValues))
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const rows = await readClassList(file)
      ingest(rows, file.name)
    } catch {
      setError('Could not read that file. Try saving it as CSV from Excel first.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function generate() {
    if (valid.length === 0) return
    cancelled.current = false
    setError(null)
    try {
      if (output === 'merged') await generateMerged()
      else await generateZip()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk generation failed')
    } finally {
      setProgress(null)
    }
  }

  async function generateMerged() {
    setProgress({ done: 0, total: 1 })
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...buildRequestBase(), rows: valid.map((r) => r.values) }),
    })
    if (!res.ok) {
      throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
    }
    triggerDownload(await res.blob(), `${meta.id}-coverpages.pdf`)
  }

  async function generateZip() {
    setProgress({ done: 0, total: valid.length })
    // Fetch with a small worker pool; assemble in row order afterwards so the
    // ZIP is deterministic no matter which fetch landed first.
    const pdfs = new Array<Uint8Array | undefined>(valid.length)
    let next = 0
    let finished = 0
    let failure: Error | undefined

    const worker = async () => {
      while (!cancelled.current && !failure) {
        const i = next++
        if (i >= valid.length) return
        const row = valid[i]
        try {
          const res = await fetch('/api/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...buildRequestBase(), values: row.values }),
          })
          if (!res.ok) {
            const msg = (await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`
            throw new Error(`Row ${row.index}: ${msg}`)
          }
          pdfs[i] = new Uint8Array(await res.arrayBuffer())
          finished++
          setProgress({ done: finished, total: valid.length })
        } catch (e) {
          failure = e instanceof Error ? e : new Error('Bulk generation failed')
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(ZIP_CONCURRENCY, valid.length) }, () => worker()),
    )
    if (cancelled.current) return
    if (failure) throw failure

    const zip = new ZipWriter()
    const used = new Set<string>()
    valid.forEach((row, i) => zip.add(pdfName(row, meta.fields, used), pdfs[i]!))
    triggerDownload(zip.finish(), `${meta.id}-coverpages.zip`)
  }

  return (
    <div className="mt-6 border-t border-rule pt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-pencil">
          Whole class at once
        </span>
        <span className="text-sm text-pencil" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <p className="text-xs">
            Bring a class list — CSV file or paste straight from Excel/Sheets. Columns the sheet
            doesn&apos;t have (Lab Name, Semester…) are taken from the form above for every
            student.
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={downloadTemplateCsv}>
              Download blank list (CSV)
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={generating}
            >
              Upload CSV
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setPasteOpen(!pasteOpen)}
              disabled={generating}
            >
              Paste from Excel
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="hidden"
              onChange={(e) => uploadFile(e.target.files?.[0])}
            />
          </div>

          {pasteOpen && (
            <div className="space-y-2">
              <textarea
                className="field-input h-24 font-mono text-xs"
                placeholder={'Copy the cells (with the header row) in Excel/Sheets, paste here.'}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost"
                disabled={pasteText.trim() === ''}
                onClick={() => ingest(parseDelimited(pasteText), 'pasted rows')}
              >
                Use pasted rows
              </button>
            </div>
          )}

          {matched && (
            <div className="space-y-2">
              <p className="text-xs">
                <span className="font-semibold text-ink">{sourceName}</span> — {valid.length}{' '}
                ready
                {invalid.length > 0 && (
                  <span className="text-margin">, {invalid.length} with problems (skipped)</span>
                )}
              </p>

              {matched.fromForm.length > 0 && (
                <p className="text-xs">
                  <span className="font-semibold text-ink">From the form for all rows:</span>{' '}
                  {matched.fromForm.join(', ')}
                </p>
              )}

              {matched.missingColumns.length > 0 && (
                <p className="text-xs text-margin">
                  {matched.missingColumns.join(', ')}: no column in the sheet and nothing in the
                  form. Add the column, or fill those fields in the form above.
                </p>
              )}

              {invalid.length > 0 && (
                <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs text-pencil">
                  {invalid.slice(0, 20).map((r) => (
                    <li key={r.index}>
                      Row {r.index}: {r.errors.join('; ')}
                    </li>
                  ))}
                </ul>
              )}

              <fieldset className="flex gap-4 text-xs">
                <legend className="sr-only">Output format</legend>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="bulk-output"
                    checked={output === 'zip'}
                    onChange={() => setOutput('zip')}
                  />
                  One PDF each (ZIP)
                </label>
                <label
                  className={`flex items-center gap-1.5 ${mergedAllowed ? '' : 'opacity-40'}`}
                >
                  <input
                    type="radio"
                    name="bulk-output"
                    checked={output === 'merged'}
                    onChange={() => setOutput('merged')}
                    disabled={!mergedAllowed}
                  />
                  One merged PDF{mergedAllowed ? '' : ` (max ${MERGE_LIMIT} rows)`}
                </label>
              </fieldset>

              <button
                type="button"
                className="btn-ink w-full"
                onClick={generate}
                disabled={valid.length === 0 || generating}
              >
                {generating
                  ? output === 'merged'
                    ? 'Making the merged PDF…'
                    : `Making PDF ${progress!.done + 1} of ${progress!.total}…`
                  : output === 'merged'
                    ? `Generate 1 PDF with ${valid.length} page${valid.length === 1 ? '' : 's'}`
                    : `Generate ${valid.length} PDF${valid.length === 1 ? '' : 's'} (ZIP)`}
              </button>
              {generating && output === 'zip' && (
                <button
                  type="button"
                  className="btn-ghost w-full"
                  onClick={() => (cancelled.current = true)}
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {error && <p className="text-xs text-margin">{error}</p>}
        </div>
      )}
    </div>
  )
}

/** Names each PDF after the row's first filled text field (usually the student). */
function pdfName(row: BulkRow, fields: readonly FieldDef[], used: Set<string>): string {
  const source =
    fields.find((f) => f.type === 'text' && (row.values[f.key] ?? '').trim() !== '') ?? null
  const base =
    (source ? row.values[source.key].trim() : '').replace(/[^\w-]+/g, '_') || `row-${row.index}`
  let name = `${base}.pdf`
  for (let n = 2; used.has(name); n++) name = `${base}-${n}.pdf`
  used.add(name)
  return name
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
