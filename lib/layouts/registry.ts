import type { LayoutComponent, LayoutId, SlotId } from '@/lib/templates/types'
import { ClassicSeal } from './classic-seal/ClassicSeal'

export interface RegisteredLayout {
  Component: LayoutComponent
  /** Slots this layout renders. A template using any other slot fails the schema test. */
  slots: readonly SlotId[]
  /**
   * Click-to-edit regions, matching the data-zone tags the layout emits in
   * interactive (preview) mode. Layout-specific, so it lives beside the
   * layout — drives the editor's tab bar.
   */
  tabs?: readonly LayoutTab[]
}

/** One editable region of a layout's page. */
export interface LayoutTab {
  id: string
  label: string
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
    // Mirrors the data-zone tags in ClassicSeal. Subtitle maps to the
    // title tab — the panel controls are identical.
    tabs: [
      { id: 'heading', label: 'Heading' },
      { id: 'seal', label: 'Seal' },
      { id: 'title', label: 'Title' },
      { id: 'details', label: 'Details' },
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
