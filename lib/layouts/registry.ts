import type { LayoutComponent, LayoutId, SlotId } from '@/lib/templates/types'

export interface RegisteredLayout {
  Component: LayoutComponent
  /** Slots this layout renders. A template using any other slot fails the schema test. */
  slots: readonly SlotId[]
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
  // 'classic-seal': { Component: ClassicSeal, slots: ['title', 'subtitle', 'details'] },
}

export function getLayout(id: LayoutId): RegisteredLayout | undefined {
  return layouts[id]
}

/** Slots a layout declares, or undefined if the layout is unknown. */
export function slotsFor(id: LayoutId): readonly SlotId[] | undefined {
  return layouts[id]?.slots
}
