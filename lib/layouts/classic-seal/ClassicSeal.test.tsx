import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
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
})
