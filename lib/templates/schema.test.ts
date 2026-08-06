import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { templateMetaSchema, valuesSchemaFor } from './schema'
import { listTemplates } from './registry'

const TEMPLATES_DIR = join(process.cwd(), 'lib', 'templates')

function templateDirs(): string[] {
  return readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(TEMPLATES_DIR, name, 'template.json')))
}

describe('template.json files', () => {
  // Passes vacuously today; guards every template from the moment one exists.
  const dirs = templateDirs()

  it.each(dirs)('%s parses against the template schema', (dir) => {
    const raw = JSON.parse(readFileSync(join(TEMPLATES_DIR, dir, 'template.json'), 'utf8'))
    expect(() => templateMetaSchema.parse(raw)).not.toThrow()
  })

  it.each(dirs)('%s has an id matching its directory name', (dir) => {
    const raw = JSON.parse(readFileSync(join(TEMPLATES_DIR, dir, 'template.json'), 'utf8'))
    expect(raw.id).toBe(dir)
  })

  it('registers every template directory in the registry', () => {
    expect(listTemplates().map((t) => t.id).sort()).toEqual(dirs.sort())
  })
})

describe('valuesSchemaFor', () => {
  const fields = [
    { key: 'name', label: 'Name', type: 'text' as const, required: true, maxLength: 40 },
    { key: 'section', label: 'Section', type: 'select' as const, options: ['A', 'B'] },
  ]

  it('accepts a complete, valid payload', () => {
    const parsed = valuesSchemaFor(fields).parse({ name: 'Aditya Mishra', section: 'A' })
    expect(parsed).toEqual({ name: 'Aditya Mishra', section: 'A' })
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
    const parsed = valuesSchemaFor(fields).parse({ name: 'X', removedField: 'stale' })
    expect(parsed).not.toHaveProperty('removedField')
  })
})
