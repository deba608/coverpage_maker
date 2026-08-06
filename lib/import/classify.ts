/**
 * Turns parsed PDF text into a draft TemplateMeta — the importer's guessing
 * half. The user corrects the guesses in the editor; this only has to be
 * right often enough to save typing.
 *
 * Heuristics (same ones used manually for the first template):
 * - top-of-page uppercase lines        → brand.institution
 * - the line after them, mixed case    → brand.address
 * - "Label : value" rows               → details fields (label left of colon)
 * - large centred text mid-page        → title, the line under it subtitle
 * - values from a known small set      → select fields with options
 */
import type { FieldDef, TemplateMeta } from '@/lib/templates/types'
import type { TextItem } from './parsePdf'

const KNOWN_OPTION_SETS: { match: RegExp; options: string[] }[] = [
  { match: /^(1st|2nd|3rd|[4-8]th)\s*Semester$/i,
    options: ['1st Semester', '2nd Semester', '3rd Semester', '4th Semester', '5th Semester', '6th Semester', '7th Semester', '8th Semester'] },
  { match: /^[A-D]$/, options: ['A', 'B', 'C', 'D'] },
  { match: /^(CSE|IT|ECE|EEE?|ME|CE|AIML|DS)$/i, options: ['CSE', 'IT', 'ECE', 'EE', 'ME', 'CE'] },
]

/** Groups items sharing a baseline (±2mm) into visual rows. */
function toRows(items: TextItem[]): TextItem[][] {
  const rows: TextItem[][] = []
  for (const item of items) {
    const row = rows.find((r) => Math.abs(r[0].yMm - item.yMm) < 2)
    if (row) row.push(item)
    else rows.push([item])
  }
  for (const row of rows) row.sort((a, b) => a.xMm - b.xMm)
  return rows.sort((a, b) => a[0].yMm - b[0].yMm)
}

function rowText(row: TextItem[]): string {
  return row.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim()
}

function slugify(label: string): string {
  const words = label.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/)
  return words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('')
}

export function classify(items: TextItem[], pageHeightMm: number): TemplateMeta {
  const rows = toRows(items)

  const institution: string[] = []
  let address: string | undefined
  const fields: FieldDef[] = []
  let title: { label: string; sample: string } | undefined
  let subtitle: { sample: string } | undefined

  for (const row of rows) {
    const text = rowText(row)
    const y = row[0].yMm
    const topThird = y < pageHeightMm / 3

    // Institution block: uppercase lines in the top third, before any colon rows.
    if (topThird && fields.length === 0 && text === text.toUpperCase() && /[A-Z]{4,}/.test(text) && institution.length < 3) {
      institution.push(text)
      continue
    }
    // Address: the first mixed-case top-third line right after the institution.
    if (topThird && institution.length > 0 && !address && text !== text.toUpperCase() && !text.includes(':')) {
      address = text
      continue
    }

    // "Label : value" rows → details fields.
    const colonMatch = text.match(/^([^:]{2,30}?)\s*:[-\s]*(.*)$/)
    if (colonMatch && !topThird) {
      const label = colonMatch[1].trim()
      const sample = colonMatch[2].trim()
      // A heading like "Submitted By :-" has no value — the layout prints it already.
      if (!sample && /submitted|certificate/i.test(label)) continue
      const known = KNOWN_OPTION_SETS.find((k) => k.match.test(sample))
      fields.push({
        key: slugify(label) || `field${fields.length}`,
        label,
        slot: 'details',
        type: known ? 'select' : 'text',
        ...(known ? { options: known.options } : { maxLength: 40 }),
        required: true,
        ...(sample && !known ? { placeholder: sample } : {}),
      })
      continue
    }

    // Mid-page prominent lines: first → title, next → subtitle.
    const midPage = y > pageHeightMm / 3 && y < (2 * pageHeightMm) / 3
    const prominent = row[0].sizePt >= 16
    if (midPage && prominent && !text.includes(':')) {
      const known = KNOWN_OPTION_SETS.find((k) => k.match.test(text))
      if (!title) {
        title = { label: 'Title', sample: text }
        fields.unshift({
          key: 'title', label: 'Title', slot: 'title', type: 'text',
          required: true, maxLength: 30, placeholder: text,
        })
      } else if (!subtitle) {
        subtitle = { sample: text }
        fields.splice(1, 0, {
          key: 'subtitle', label: 'Subtitle', slot: 'subtitle',
          type: known ? 'select' : 'text',
          ...(known ? { options: known.options } : { maxLength: 30, placeholder: text }),
          required: false,
        })
      }
    }
  }

  // Dedupe keys the slugifier may have collided.
  const seen = new Set<string>()
  for (const f of fields) {
    let key = f.key
    let n = 2
    while (seen.has(key)) key = `${f.key}${n++}`
    seen.add(key)
    f.key = key
  }

  const id = `custom-${Date.now().toString(36)}`
  return {
    id,
    name: institution[0]
      ? institution[0].toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
      : 'My Template',
    description: 'Imported from PDF',
    thumbnail: '/window.svg', // replaced by a real render once saved
    layout: 'classic-seal',
    brand: {
      institution: institution.length ? institution : ['MY COLLEGE'],
      ...(address ? { address } : {}),
      font: 'times',
      border: 'double',
    },
    fields: fields.length
      ? fields
      : [{ key: 'name', label: 'Name', slot: 'details', type: 'text', required: true, maxLength: 40 }],
  }
}
