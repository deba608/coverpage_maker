import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { templateMetaSchema, valuesSchemaFor, type ParsedFieldDef } from './schema'
import { listTemplates, registryEntries } from './registry'
import { slotsFor } from '@/lib/layouts/registry'

const TEMPLATES_DIR = join(process.cwd(), 'lib', 'templates')

function templateDirs(): string[] {
  return readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(TEMPLATES_DIR, name, 'template.json')))
}

function readTemplate(dir: string): unknown {
  return JSON.parse(readFileSync(join(TEMPLATES_DIR, dir, 'template.json'), 'utf8'))
}

/**
 * These run over every template automatically, so a hand-written template.json
 * with a typo fails CI instead of rendering a broken page. That guarantee is
 * what makes JSON-only template authoring safe.
 *
 * They pass vacuously until the first template lands.
 */
describe('template.json files', () => {
  const dirs = templateDirs()

  it.each(dirs)('%s parses against the template schema', (dir) => {
    expect(() => templateMetaSchema.parse(readTemplate(dir))).not.toThrow()
  })

  it.each(dirs)('%s has an id matching its directory name', (dir) => {
    expect((readTemplate(dir) as { id: string }).id).toBe(dir)
  })

  it.each(dirs)('%s uses only slots its layout declares', (dir) => {
    const meta = templateMetaSchema.parse(readTemplate(dir))
    if (meta.layout === 'custom') return // custom templates own their own slots

    const declared = slotsFor(meta.layout)
    expect(declared, `layout '${meta.layout}' is not registered`).toBeDefined()

    for (const field of meta.fields) {
      expect(declared, `field '${field.key}' uses slot '${field.slot}'`).toContain(field.slot)
    }
  })

  it.each(dirs)('%s referencing layout "custom" ships a component', (dir) => {
    const meta = templateMetaSchema.parse(readTemplate(dir))
    if (meta.layout !== 'custom') return

    const entry = registryEntries().find((t) => t.meta.id === meta.id)
    expect(entry?.CustomComponent).toBeTypeOf('function')
  })

  it('registers every template directory in the registry', () => {
    expect(listTemplates().map((t) => t.id).sort()).toEqual([...dirs].sort())
  })
})

describe('templateMetaSchema', () => {
  const valid = {
    id: 'demo-lab',
    name: 'Demo',
    description: 'A demo template',
    thumbnail: '/templates/demo-lab/thumb.png',
    layout: 'classic-seal',
    brand: { institution: ['DEMO UNIVERSITY'], font: 'times', border: 'double' },
    fields: [
      { key: 'labName', label: 'Lab Name', type: 'text', slot: 'title', required: true },
      { key: 'name', label: 'Name', type: 'text', slot: 'details', required: true },
    ],
  }

  it('accepts a well-formed template', () => {
    expect(() => templateMetaSchema.parse(valid)).not.toThrow()
  })

  it('rejects duplicate field keys', () => {
    const dup = { ...valid, fields: [valid.fields[0], { ...valid.fields[1], key: 'labName' }] }
    expect(() => templateMetaSchema.parse(dup)).toThrow()
  })

  it('rejects two fields competing for the title slot', () => {
    const two = { ...valid, fields: [valid.fields[0], { ...valid.fields[1], slot: 'title' }] }
    expect(() => templateMetaSchema.parse(two)).toThrow()
  })

  it('rejects a select field with no options', () => {
    const bad = {
      ...valid,
      fields: [{ key: 'section', label: 'Section', type: 'select', slot: 'details' }],
    }
    expect(() => templateMetaSchema.parse(bad)).toThrow()
  })

  it('rejects an unknown layout id', () => {
    expect(() => templateMetaSchema.parse({ ...valid, layout: 'nope' })).toThrow()
  })

  it('rejects a non-kebab-case id', () => {
    expect(() => templateMetaSchema.parse({ ...valid, id: 'Demo Lab' })).toThrow()
  })
})

describe('valuesSchemaFor', () => {
  const fields: ParsedFieldDef[] = [
    { key: 'name', label: 'Name', type: 'text', slot: 'details', required: true, maxLength: 40 },
    { key: 'section', label: 'Section', type: 'select', slot: 'details', options: ['A', 'B'] },
  ]

  it('accepts a complete, valid payload', () => {
    expect(valuesSchemaFor(fields).parse({ name: 'Aditya Mishra', section: 'A' })).toEqual({
      name: 'Aditya Mishra',
      section: 'A',
    })
  })

  it('rejects a missing required field', () => {
    expect(() => valuesSchemaFor(fields).parse({ name: '', section: 'A' })).toThrow()
  })

  it('rejects a select value outside its options', () => {
    expect(() => valuesSchemaFor(fields).parse({ name: 'X', section: 'Z' })).toThrow()
  })

  it('rejects a value longer than maxLength', () => {
    expect(() => valuesSchemaFor(fields).parse({ name: 'x'.repeat(41) })).toThrow()
  })

  it('drops unknown keys instead of failing', () => {
    expect(valuesSchemaFor(fields).parse({ name: 'X', removedField: 'stale' })).not.toHaveProperty(
      'removedField',
    )
  })
})
