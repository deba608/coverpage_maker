/**
 * The contract every coverpage template must satisfy.
 *
 * A template is two things: a `TemplateMeta` describing the inputs it needs
 * (which drives the form UI), and a React component that turns those inputs
 * into an A4 page. Adding a template means adding those two files and one
 * registry line — never editing the form, the preview, or the render route.
 */

export type FieldType = 'text' | 'select' | 'number' | 'date'

export interface FieldDef {
  /** Key in the values object. Unique within a template. */
  key: string
  /** Shown as the input's label. */
  label: string
  type: FieldType
  required?: boolean
  /** Required when `type` is 'select'. */
  options?: string[]
  placeholder?: string
  /** Guards the layout against text that would overflow its box. */
  maxLength?: number
}

export interface TemplateMeta {
  id: string
  name: string
  description: string
  /** Path under /public, e.g. /templates/sambalpur-lab/thumb.png */
  thumbnail: string
  fields: FieldDef[]
}

/** Form state: every field's current value, keyed by `FieldDef.key`. */
export type TemplateValues = Record<string, string>

/** A template component is a pure function of its values — no hooks, no browser APIs. */
export type TemplateComponent = (props: { values: TemplateValues }) => React.ReactElement
