'use client'

import type { FieldDef, TemplateValues } from '@/lib/templates/types'

/**
 * Renders one input per FieldDef. Knows nothing about layouts or any specific
 * template — the schema drives everything, which is what lets a new template
 * ship as JSON only.
 */
export function DynamicForm({
  fields,
  values,
  onChange,
}: {
  fields: readonly FieldDef[]
  values: TemplateValues
  onChange: (values: TemplateValues) => void
}) {
  const set = (key: string, value: string) => onChange({ ...values, [key]: value })

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      {fields.map((field) => {
        const id = `field-${field.key}`
        return (
          <div key={field.key}>
            <label htmlFor={id} className="mb-1 block text-[0.8125rem] font-semibold text-ink">
              {field.label}
              {field.required && <span className="text-margin"> *</span>}
            </label>

            {field.type === 'select' ? (
              <select
                id={id}
                className="field-input"
                value={values[field.key] ?? ''}
                onChange={(e) => set(field.key, e.target.value)}
              >
                <option value="">Choose…</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                className="field-input"
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                value={values[field.key] ?? ''}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                onChange={(e) => set(field.key, e.target.value)}
              />
            )}
          </div>
        )
      })}
    </form>
  )
}

/** True when every required field has a non-empty value. */
export function isComplete(fields: readonly FieldDef[], values: TemplateValues): boolean {
  return fields.every((f) => !f.required || (values[f.key]?.trim() ?? '') !== '')
}
