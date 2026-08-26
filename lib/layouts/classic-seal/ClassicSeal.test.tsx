import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { fireEvent, render } from '@testing-library/react'
import { ClassicSeal } from './ClassicSeal'
import type { BrandConfig, FieldDef } from '@/lib/templates/types'
import sambalpurLab from '@/lib/templates/sambalpur-lab/template.json'
import { templateMetaSchema } from '@/lib/templates/schema'

const meta = templateMetaSchema.parse(sambalpurLab)

const full = {
  labName: 'CN LAB',
  semester: '4th Semester',
  name: 'Debashish Pradhan',
  rollNo: '24BTCSE04',
  section: 'A',
  branch: 'CSE',
}

/**
 * Purity contract: the PDF route calls renderToStaticMarkup on the server, so
 * a layout that sneaks in a hook or a browser API breaks there first. These
 * tests catch that in CI instead.
 */
describe('ClassicSeal', () => {
  it('renders server-side with full values', () => {
    const html = renderToStaticMarkup(
      <ClassicSeal brand={meta.brand} fields={meta.fields} values={full} />,
    )
    for (const v of Object.values(full)) expect(html).toContain(v)
    for (const line of meta.brand.institution) expect(html).toContain(line)
  })

  it('renders placeholders, not blanks, with empty values', () => {
    const html = renderToStaticMarkup(
      <ClassicSeal brand={meta.brand} fields={meta.fields} values={{}} />,
    )
    expect(html).toContain('[Lab Name]')
    expect(html).toContain('[Name]')
  })

  it('is generic: renders a different brand with no logo and one heading line', () => {
    const brand: BrandConfig = { institution: ['SOME OTHER COLLEGE'], font: 'sans', border: 'none' }
    const fields: FieldDef[] = [
      { key: 'name', label: 'Student', type: 'text', slot: 'details', required: true },
    ]
    const html = renderToStaticMarkup(
      <ClassicSeal brand={brand} fields={fields} values={{ name: 'X' }} />,
    )
    expect(html).toContain('SOME OTHER COLLEGE')
    expect(html).not.toContain('<img')
  })

  it('renders logo with customized size, alignment, and position offset', () => {
    const brand: BrandConfig = {
      ...meta.brand,
      logoWidthMm: 75,
      logoAlign: 'left',
      logoOffsetYMm: 12,
    }
    const html = renderToStaticMarkup(
      <ClassicSeal brand={brand} fields={meta.fields} values={full} />,
    )
    expect(html).toContain('--cs-logo-width:75mm')
    expect(html).toContain('--cs-logo-align:flex-start')
    expect(html).toContain('--cs-logo-offset-y:12mm')
  })

  it('tags values and zones only in interactive mode — the PDF path stays clean', () => {
    const pdf = renderToStaticMarkup(
      <ClassicSeal brand={meta.brand} fields={meta.fields} values={full} />,
    )
    expect(pdf).not.toContain('data-field-key')
    expect(pdf).not.toContain('data-zone')

    const preview = renderToStaticMarkup(
      <ClassicSeal brand={meta.brand} fields={meta.fields} values={full} interactive />,
    )
    expect(preview).toContain('data-field-key')
    expect(preview).toContain('data-zone')
    expect(preview).not.toContain('contenteditable')
  })

  it('renders a contentEditable only for the field named by editingKey', () => {
    const html = renderToStaticMarkup(
      <ClassicSeal
        brand={meta.brand}
        fields={meta.fields}
        values={full}
        interactive
        editingKey="labName"
      />,
    )
    expect(html).toMatch(/contenteditable/i)
    expect(html).toContain('data-editing="true"')
  })

  it('commits trimmed text on blur; Escape-flagged blur discards instead', () => {
    const onCommitEdit = vi.fn()
    const onCancelEdit = vi.fn()
    const { getByText, unmount } = render(
      <ClassicSeal
        brand={meta.brand}
        fields={meta.fields}
        values={{ ...full, labName: 'CN LAB' }}
        interactive
        editingKey="labName"
        onCommitEdit={onCommitEdit}
        onCancelEdit={onCancelEdit}
      />,
    )
    const editor = getByText('CN LAB')
    editor.textContent = '  OS LAB  '
    fireEvent.blur(editor)
    expect(onCommitEdit).toHaveBeenCalledWith('labName', 'OS LAB')
    expect(onCancelEdit).not.toHaveBeenCalled()
    unmount()

    const onCommit2 = vi.fn()
    const onCancel2 = vi.fn()
    const second = render(
      <ClassicSeal
        brand={meta.brand}
        fields={meta.fields}
        values={{ ...full, labName: 'CN LAB' }}
        interactive
        editingKey="labName"
        onCommitEdit={onCommit2}
        onCancelEdit={onCancel2}
      />,
    )
    const cancelled = second.getByText('CN LAB')
    cancelled.textContent = 'typed junk'
    ;(cancelled as HTMLElement).dataset.cancelled = 'true'
    fireEvent.blur(cancelled)
    expect(onCancel2).toHaveBeenCalled()
    expect(onCommit2).not.toHaveBeenCalled()
    second.unmount()
  })
})
