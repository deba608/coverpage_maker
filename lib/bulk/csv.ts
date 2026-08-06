import type { FieldDef, TemplateValues } from '@/lib/templates/types'

/**
 * CSV in, values out — the bulk pipeline's data leg.
 *
 * Column headers are field *labels* (what a teacher pasting from a class list
 * recognises), matched case-insensitively to the template's fields. Parsing
 * handles quoted cells, embedded commas/newlines, and CRLF.
 */

/** One row's outcome: parsed values plus anything wrong with them. */
export interface BulkRow {
  index: number
  values: TemplateValues
  errors: string[]
}

/** A CSV the user can fill in: one header row of field labels, one blank row. */
export function buildTemplateCsv(fields: readonly FieldDef[]): string {
  const header = fields.map((f) => escapeCell(f.label)).join(',')
  const example = fields
    .map((f) => escapeCell(f.type === 'select' ? (f.options?.[0] ?? '') : (f.placeholder ?? '')))
    .join(',')
  return `${header}\r\n${example}\r\n`
}

function escapeCell(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Excel/Sheets paste support: pasted cells arrive tab-separated. If the first
 * line contains a tab, tabs are the delimiter; otherwise commas.
 */
export function parseDelimited(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'))
  return firstLine.includes('\t') ? parseCsv(text, '\t') : parseCsv(text, ',')
}

/** RFC-4180-ish parser. Returns rows of cells; skips fully empty rows. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else {
      cell += ch
    }
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

export interface MatchResult {
  rows: BulkRow[]
  /** Labels of fields with no CSV column, filled from the form for every row. */
  fromForm: string[]
  /** Labels of required fields with no CSV column AND no form value — blocking. */
  missingColumns: string[]
}

/**
 * Matches a parsed CSV against a template's fields.
 *
 * Header labels are matched case-insensitively with whitespace collapsed, so
 * "Roll  no" finds "Roll No". Unknown columns are ignored — a class list often
 * has extras like email.
 *
 * A field with no column is not automatically an error: it falls back to
 * `formValues` (what's typed in the form), because Lab Name / Semester are the
 * same for the whole class and nobody repeats them per row. The form is the
 * constants editor; the CSV holds only what varies per student. A required
 * field missing from *both* is the only blocking case.
 */
export function matchCsv(
  cells: string[][],
  fields: readonly FieldDef[],
  formValues: TemplateValues = {},
): MatchResult {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const header = (cells[0] ?? []).map(norm)
  const columnFor = new Map<string, number>()
  for (const f of fields) {
    const at = header.indexOf(norm(f.label))
    if (at !== -1) columnFor.set(f.key, at)
  }

  const fromForm: string[] = []
  const missingColumns: string[] = []
  for (const f of fields) {
    if (columnFor.has(f.key)) continue
    if ((formValues[f.key] ?? '').trim() !== '') fromForm.push(f.label)
    else if (f.required) missingColumns.push(f.label)
  }

  const rows: BulkRow[] = cells.slice(1).map((cellsRow, i) => {
    const values: TemplateValues = {}
    const errors: string[] = []
    for (const f of fields) {
      const at = columnFor.get(f.key)
      const own = at === undefined ? '' : (cellsRow[at] ?? '').trim()
      const raw = own !== '' ? own : at === undefined ? (formValues[f.key] ?? '').trim() : own
      values[f.key] = raw
      if (f.required && raw === '') errors.push(`${f.label} is empty`)
      else if (f.type === 'select' && raw !== '' && !f.options?.includes(raw))
        errors.push(`${f.label} must be one of: ${f.options?.join(', ')}`)
      else if (f.maxLength && raw.length > f.maxLength)
        errors.push(`${f.label} is longer than ${f.maxLength} characters`)
    }
    return { index: i + 1, values, errors }
  })

  return { rows, fromForm, missingColumns }
}
