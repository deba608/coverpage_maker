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

/** RFC-4180-ish parser. Returns rows of cells; skips fully empty rows. */
export function parseCsv(text: string): string[][] {
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
    } else if (ch === ',') {
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

/**
 * Matches a parsed CSV against a template's fields.
 *
 * Header labels are matched case-insensitively with whitespace collapsed, so
 * "Roll  no" finds "Roll No". Unknown columns are ignored — a class list often
 * has extras like email. Each data row is checked the same way the form is:
 * required fields present, select values among their options.
 */
export function matchCsv(
  cells: string[][],
  fields: readonly FieldDef[],
): { rows: BulkRow[]; missingColumns: string[] } {
  if (cells.length === 0) return { rows: [], missingColumns: fields.map((f) => f.label) }

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const header = cells[0].map(norm)
  const columnFor = new Map<string, number>()
  for (const f of fields) {
    const at = header.indexOf(norm(f.label))
    if (at !== -1) columnFor.set(f.key, at)
  }

  const missingColumns = fields
    .filter((f) => f.required && !columnFor.has(f.key))
    .map((f) => f.label)

  const rows: BulkRow[] = cells.slice(1).map((cellsRow, i) => {
    const values: TemplateValues = {}
    const errors: string[] = []
    for (const f of fields) {
      const at = columnFor.get(f.key)
      const raw = at === undefined ? '' : (cellsRow[at] ?? '').trim()
      values[f.key] = raw
      if (f.required && raw === '') errors.push(`${f.label} is empty`)
      else if (f.type === 'select' && raw !== '' && !f.options?.includes(raw))
        errors.push(`${f.label} must be one of: ${f.options?.join(', ')}`)
      else if (f.maxLength && raw.length > f.maxLength)
        errors.push(`${f.label} is longer than ${f.maxLength} characters`)
    }
    return { index: i + 1, values, errors }
  })

  return { rows, missingColumns }
}
