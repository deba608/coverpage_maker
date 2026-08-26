import type { ReactElement } from 'react'

/**
 * The contract every coverpage template must satisfy.
 *
 * A template is *data*, not code: a JSON file naming a layout, its branding, and
 * the fields it collects. A layout is the React component that turns those into
 * an A4 page, written once and reused by many templates.
 *
 * Adding a template therefore means adding one JSON file (and a logo) — never
 * editing the form, the preview, the layout, or the render route.
 */

export type FieldType = 'text' | 'select' | 'number' | 'date'

/**
 * Where a field renders on the page. Layouts declare which slots they support;
 * the schema test rejects a template that uses one its layout does not.
 */
export type SlotId = 'title' | 'subtitle' | 'details'

export interface FieldDef {
  /** Key in the values object. Unique within a template. */
  key: string
  /** Input label, and — for `details` fields — the text left of the colon on the page. */
  label: string
  type: FieldType
  slot: SlotId
  required?: boolean
  /** Required when `type` is 'select'. */
  options?: string[]
  placeholder?: string
  /** Guards the layout against text that would overflow its box. */
  maxLength?: number
}

/**
 * The knobs a layout exposes to its templates.
 *
 * Deliberately small. A layout is allowed to be opinionated — if a template
 * needs a knob that isn't here, that is evidence it wants a different layout,
 * not a bigger config.
 */
export interface BrandConfig {
  /** 1–3 heading lines, rendered largest-first. */
  institution: string[]
  address?: string
  /** Path under /public, e.g. /templates/sambalpur-lab/seal.png */
  logo?: string
  /** Rendered logo width in millimetres. Default 55. */
  logoWidthMm?: number
  /** Horizontal alignment of the logo: 'left' | 'center' | 'right'. Default 'center'. */
  logoAlign?: 'left' | 'center' | 'right'
  /** Vertical position offset in millimetres (-40 to 40). Default 0. */
  logoOffsetYMm?: number
  font: 'serif' | 'sans' | 'times' | 'garamond'
  border: 'double' | 'single' | 'none'
  /** Hex colour for rules and headings. Default #000. */
  accentColor?: string
  /** Distance in mm from page edge to the outer border line. Default 14. */
  borderInsetMm?: number
  /** Institution heading font size in pt. Default 20. */
  institutionSizePt?: number
  /** Lab name / title font size in pt. Default 24. */
  titleSizePt?: number
  /** Details box font size in pt. Default 20. */
  detailsSizePt?: number
  /** Content top padding in mm (controls vertical position). Default 28. */
  contentTopMm?: number
}

/**
 * `custom` means the template ships its own component instead of using a shared
 * layout. An escape hatch so one unusual design can never block the project —
 * reaching for it twice on similar pages means a new shared layout is the right
 * answer instead.
 */
export type LayoutId = 'classic-seal' | 'custom'

export interface TemplateMeta {
  id: string
  name: string
  description: string
  /** Path under /public, e.g. /templates/sambalpur-lab/thumb.png */
  thumbnail: string
  layout: LayoutId
  brand: BrandConfig
  fields: FieldDef[]
}

/** Form state: every field's current value, keyed by `FieldDef.key`. */
export type TemplateValues = Record<string, string>

export interface LayoutProps {
  brand: BrandConfig
  fields: readonly FieldDef[]
  values: TemplateValues
  /**
   * True only in the on-screen preview: the layout then tags its editable
   * regions with data-zone attributes and its field values with
   * data-field-key, so the editor can offer click-to-edit and double-click
   * inline typing. Never set on the PDF path, which must stay a clean static
   * document.
   */
  interactive?: boolean
  /** Field key with a live inline editor (interactive mode only). */
  editingKey?: string | null
  /** Blur/Enter ends the edit; the trimmed text becomes the field value. */
  onCommitEdit?: (key: string, value: string) => void
  /** Escape abandons the edit; the previous value stays. */
  onCancelEdit?: () => void
}

/**
 * A layout is a pure function of its props: no hooks, no browser APIs (it must
 * render on the server), no network requests. It renders exactly one
 * 210mm x 297mm root element.
 */
export type LayoutComponent = (props: LayoutProps) => ReactElement

/** Convenience: the fields assigned to one slot, in declaration order. */
export function fieldsInSlot(fields: readonly FieldDef[], slot: SlotId): FieldDef[] {
  return fields.filter((f) => f.slot === slot)
}
