'use client'

import { useRef, useState } from 'react'
import type { FieldDef, TemplateMeta } from '@/lib/templates/types'
import { buildTemplateCsv, matchCsv, parseCsv, type BulkRow } from '@/lib/bulk/csv'
import { ZipWriter } from '@/lib/bulk/zip'

/**
 * Whole-class mode: download a CSV with this template's columns, fill one row
 * per student, upload it back, get a ZIP of PDFs.
 *
 * Each PDF is rendered by the same /api/render call the single download uses —
 * one request per row, sequential, so the serverless route stays warm and the
 * progress count is honest. The ZIP is assembled in the browser.
 */
export function BulkPanel({
  meta,
  buildRequestBody,
}: {
  meta: TemplateMeta
  buildRequestBody: (values: Record<string, string>) => object
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<BulkRow[] | null>(null)
  const [missingColumns, setMissingColumns] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cancelled = useRef(false)

  const valid = rows?.filter((r) => r.errors.length === 0) ?? []
  const invalid = rows?.filter((r) => r.errors.length > 0) ?? []
  const generating = progress !== null

  function downloadTemplateCsv() {
    const blob = new Blob([buildTemplateCsv(meta.fields)], { type: 'text/csv' })
    triggerDownload(blob, `${meta.id}-class-list.csv`)
  }

  async function uploadCsv(file: File | undefined) {
    if (!file) return
    setError(null)
    setFileName(file.name)
    const matched = matchCsv(parseCsv(await file.text()), meta.fields)
    setRows(matched.rows)
    setMissingColumns(matched.missingColumns)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function generateAll() {
    if (valid.length === 0) return
    cancelled.current = false
    setError(null)
    setProgress({ done: 0, total: valid.length })
    const zip = new ZipWriter()
    const used = new Set<string>()

    try {
      for (let i = 0; i < valid.length; i++) {
        if (cancelled.current) return
        const row = valid[i]
        const res = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildRequestBody(row.values)),
        })
        if (!res.ok) {
          const msg = (await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`
          throw new Error(`Row ${row.index}: ${msg}`)
        }
        zip.add(pdfName(row, meta.fields, used), new Uint8Array(await res.arrayBuffer()))
        setProgress({ done: i + 1, total: valid.length })
      }
      triggerDownload(zip.finish(), `${meta.id}-coverpages.zip`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk generation failed')
    } finally {
      setProgress(null)
    }
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
            Download the class list, fill one row per student in Excel or Sheets, upload it back.
            You get a ZIP with one PDF per row.
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={downloadTemplateCsv}>
              1 · Download class list (CSV)
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={generating}
            >
              2 · Upload filled list
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => uploadCsv(e.target.files?.[0])}
            />
          </div>

          {rows && (
            <div className="space-y-2">
              <p className="text-xs">
                <span className="font-semibold text-ink">{fileName}</span> — {valid.length} ready
                {invalid.length > 0 && (
                  <span className="text-margin">, {invalid.length} with problems (skipped)</span>
                )}
              </p>

              {missingColumns.length > 0 && (
                <p className="text-xs text-margin">
                  Missing required columns: {missingColumns.join(', ')}. Use the downloaded CSV as
                  the starting point.
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

              <button
                type="button"
                className="btn-ink w-full"
                onClick={generateAll}
                disabled={valid.length === 0 || generating}
              >
                {generating
                  ? `Making PDF ${progress!.done + 1} of ${progress!.total}…`
                  : `3 · Generate ${valid.length} PDF${valid.length === 1 ? '' : 's'} (ZIP)`}
              </button>
              {generating && (
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
