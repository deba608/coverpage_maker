import { describe, expect, it } from 'vitest'
import { buildTemplateCsv, matchCsv, parseCsv, parseDelimited } from './csv'
import type { FieldDef } from '@/lib/templates/types'

const fields: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text', slot: 'details', required: true, maxLength: 40 },
  { key: 'roll', label: 'Roll No', type: 'text', slot: 'details', required: true },
  {
    key: 'section',
    label: 'Section',
    type: 'select',
    slot: 'details',
    options: ['A', 'B'],
  },
]

describe('parseCsv', () => {
  it('splits rows and cells', () => {
    expect(parseCsv('a,b\r\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('handles quoted cells with commas, quotes, and newlines', () => {
    expect(parseCsv('"x, y","he said ""hi""","line1\nline2"')).toEqual([
      ['x, y', 'he said "hi"', 'line1\nline2'],
    ])
  })

  it('parses tab-separated paste via parseDelimited', () => {
    expect(parseDelimited('a\tb\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
    expect(parseDelimited('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('skips fully empty rows', () => {
    expect(parseCsv('a,b\n\n , \nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
})

describe('buildTemplateCsv', () => {
  it('emits one header of labels plus an example row', () => {
    const rows = parseCsv(buildTemplateCsv(fields))
    expect(rows[0]).toEqual(['Name', 'Roll No', 'Section'])
    expect(rows[1][2]).toBe('A') // first select option as the example
  })
})

describe('matchCsv', () => {
  it('matches headers case-insensitively with collapsed whitespace', () => {
    const { rows, missingColumns } = matchCsv(
      [
        ['name', 'ROLL  no', 'Section'],
        ['Asha', '42', 'A'],
      ],
      fields,
    )
    expect(missingColumns).toEqual([])
    expect(rows[0].errors).toEqual([])
    expect(rows[0].values).toEqual({ name: 'Asha', roll: '42', section: 'A' })
  })

  it('blocks only when a required field has no column and no form value', () => {
    const { missingColumns } = matchCsv([['Name', 'Email'], ['Asha', 'a@x.com']], fields)
    expect(missingColumns).toEqual(['Roll No'])
  })

  it('falls back to form values for missing columns and reports them', () => {
    const { rows, fromForm, missingColumns } = matchCsv(
      [
        ['Name'],
        ['Asha'],
        ['Ravi'],
      ],
      fields,
      { roll: '42', section: 'A' },
    )
    expect(missingColumns).toEqual([])
    expect(fromForm).toEqual(['Roll No', 'Section'])
    expect(rows.map((r) => r.values.roll)).toEqual(['42', '42'])
    expect(rows.every((r) => r.errors.length === 0)).toBe(true)
  })

  it('lets a present column win over the form value', () => {
    const { rows } = matchCsv(
      [
        ['Name', 'Roll No'],
        ['Asha', '99'],
      ],
      fields,
      { roll: '42' },
    )
    expect(rows[0].values.roll).toBe('99')
  })

  it('flags empty required, bad select, and overlong values per row', () => {
    const { rows } = matchCsv(
      [
        ['Name', 'Roll No', 'Section'],
        ['', '42', 'Z'],
        ['x'.repeat(41), '43', 'B'],
      ],
      fields,
    )
    expect(rows[0].errors).toEqual(['Name is empty', 'Section must be one of: A, B'])
    expect(rows[1].errors).toEqual(['Name is longer than 40 characters'])
  })
})
