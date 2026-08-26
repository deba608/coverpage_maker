import type { LayoutComponent, LayoutId, SlotId } from '@/lib/templates/types'
import { ClassicSeal } from './classic-seal/ClassicSeal'

export interface RegisteredLayout {
  Component: LayoutComponent
  /** Slots this layout renders. A template using any other slot fails the schema test. */
  slots: readonly SlotId[]
  /**
   * Click-to-edit bands over the preview, in A4 CSS pixels at 96dpi with y
   * measured from the page top. Layout-specific geometry, so it lives beside
   * the layout — a generic overlay would misalign any new design.
   */
  zones?: readonly LayoutZone[]
}

/** One clickable region of the preview page. */
export interface LayoutZone {
  id: string
  label: string
  y0: number
  y1: number
}

/**
 * Every shared layout.
 *
 * A layout is written once and reused by many templates, which is what keeps the
 * cost of template #10 down to a JSON file. `custom` is absent by design: a
 * template with `layout: 'custom'` supplies its own component through the
 * template registry instead.
 */
export const layouts: Partial<Record<LayoutId, RegisteredLayout>> = {
  'classic-seal': {
    Component: ClassicSeal,
    slots: ['title', 'subtitle', 'details'],
    // Bands tuned against classic-seal's default geometry: heading block,
    // seal band, the big title line, then the details box.
    zones: [
      { id: 'heading', label: 'Heading', y0: 0, y1: 230 },
      { id: 'seal', label: 'Seal', y0: 230, y1: 700 },
      { id: 'title', label: 'Title', y0: 700, y1: 840 },
      { id: 'details', label: 'Details', y0: 840, y1: 1123 },
    ],
  },
}

export function getLayout(id: LayoutId): RegisteredLayout | undefined {
  return layouts[id]
}

/** Slots a layout declares, or undefined if the layout is unknown. */
export function slotsFor(id: LayoutId): readonly SlotId[] | undefined {
  return layouts[id]?.slots
}
