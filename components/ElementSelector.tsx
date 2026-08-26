'use client'

import { useEffect, useRef, useState } from 'react'
import type { BrandConfig } from '@/lib/templates/types'
import type { LayoutTab } from '@/lib/layouts/registry'
import type { BrandOverrides } from '@/lib/customize'

type ZoneId = string

/** The always-present "whole page" tab, appended after the layout's tabs. */
const PAGE_TAB: ZoneId = 'page'

/** A4 at 96dpi. Dividing by 210 mm width converts drag px to real mm. */
const A4_WIDTH_PX = 794

const FONT_OPTIONS: BrandConfig['font'][] = ['times', 'serif', 'garamond', 'sans']
const FONT_LABELS: Record<BrandConfig['font'], string> = {
  times: 'Times New Roman', serif: 'Serif', garamond: 'Garamond', sans: 'Sans-serif',
}
const BORDER_OPTIONS: BrandConfig['border'][] = ['double', 'single', 'none']
const BORDER_LABELS: Record<BrandConfig['border'], string> = {
  double: 'Double line', single: 'Single line', none: 'No border',
}

interface Props {
  brand: BrandConfig
  overrides: BrandOverrides
  onChange: (next: BrandOverrides) => void
  children: React.ReactNode
  /** Editable-region metadata from the layout registry; drives the tab bar. */
  tabs?: readonly LayoutTab[]
  /** Double-click on a tagged value starts an inline edit for that field. */
  onRequestEdit?: (key: string) => void
  /**
   * Preview scale (container px / A4 px). Drag deltas are measured in screen
   * px, so converting them to mm needs the current zoom factor.
   */
  scale: number
}

/* ── tiny reusable controls ── */

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-4">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-pencil">{label}</span>
      {children}
    </label>
  )
}

function NumInput({
  value, min, max, step = 1, unit = '', onChange,
}: {
  value: number; min: number; max: number; step?: number; unit?: string
  onChange: (v: number) => void
}) {
  // Draft state holds partial input ("-", "") while typing. Committing only
  // finite numbers keeps NaN out of the overrides — a stored NaN serializes
  // to null in localStorage and later fails schema validation on download.
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={min} max={max} step={step}
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isFinite(n)) {
            onChange(Math.max(min, Math.min(max, n)))
          }
        }}
        onBlur={() => setDraft(null)}
        className="w-16 rounded border border-rule bg-sheet px-2 py-1 text-sm text-ink tabular-nums"
      />
      {unit && <span className="text-xs text-pencil">{unit}</span>}
    </div>
  )
}

function SelInput<T extends string>({
  value, options, labels, width = 'w-36', onChange,
}: {
  value: T; options: T[]; labels: Record<T, string>; width?: string
  onChange: (v: T) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`${width} rounded border border-rule bg-sheet px-2 py-1 text-sm text-ink`}
    >
      {options.map((o) => <option key={o} value={o}>{labels[o]}</option>)}
    </select>
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-rule bg-sheet p-0.5"
      />
      <span className="font-mono text-xs text-pencil">{value.toUpperCase()}</span>
    </div>
  )
}

/* ── main component ── */

export function ElementSelector({
  brand,
  overrides,
  onChange,
  children,
  tabs = [],
  onRequestEdit,
  scale,
}: Props) {
  const [active, setActive] = useState<ZoneId>(tabs[0]?.id ?? PAGE_TAB)
  const [collapsed, setCollapsed] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)

  // Drag sessions live in refs: pointermove fires faster than React renders,
  // and the baseline values must not shift mid-drag as overrides update.
  interface DragSession {
    mode: 'seal' | 'heading' | 'resize'
    startX: number
    startY: number
    baseWidthMm: number
    baseOffsetXMm: number
    baseOffsetYMm: number
    baseTopMm: number
  }
  const drag = useRef<DragSession | null>(null)
  // A real drag must not double as a click (which would toggle the panel).
  const draggedRef = useRef(false)

  const allTabs: { id: ZoneId; label: string }[] = [
    ...tabs.map((t) => ({ id: t.id, label: t.label })),
    { id: PAGE_TAB, label: 'Page' },
  ]

  // Persistent outline on the active region: style the live preview DOM
  // directly — CSS cannot key off React state. Cleaned up on every change so
  // switching tabs (or collapsing) never leaves a stale ring behind.
  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    const applied: HTMLElement[] = []
    if (!collapsed && active !== PAGE_TAB) {
      root
        .querySelectorAll<HTMLElement>(`[data-zone="${CSS.escape(active)}"]`)
        .forEach((el) => {
          el.style.outline = '2px solid rgba(59,130,246,0.5)'
          el.style.outlineOffset = '2px'
          applied.push(el)
        })
    }
    return () => {
      for (const el of applied) {
        el.style.outline = ''
        el.style.outlineOffset = ''
      }
    }
  }, [active, collapsed])

  // Click selects a region's tab; double-click on a tagged field value enters
  // inline text editing. Both delegate off the live preview DOM.
  function handlePreviewClick(e: React.MouseEvent) {
    // A drag ends with a click event; it must not also flip the panel.
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    // Keystrokes moving the caret inside the open editor must not flip tabs
    // or toggle the panel — clicks there are text edits, not selection.
    if ((e.target as HTMLElement).closest('[data-editing]')) return
    const zoneId = (e.target as HTMLElement)
      .closest('[data-zone]')
      ?.getAttribute('data-zone')
    if (zoneId) handleZoneClick(zoneId)
  }

  function handlePreviewDoubleClick(e: React.MouseEvent) {
    const key = (e.target as HTMLElement)
      .closest('[data-field-key]')
      ?.getAttribute('data-field-key')
    if (!key || !onRequestEdit) return
    onRequestEdit(key)
    // Jump the panel to the region that owns the value, if it has one.
    const zoneId = (e.target as HTMLElement)
      .closest('[data-zone]')
      ?.getAttribute('data-zone')
    if (zoneId) {
      setActive(zoneId)
      setCollapsed(false)
    }
  }

  const set = <K extends keyof BrandOverrides>(key: K, val: BrandOverrides[K]) =>
    onChange({ ...overrides, [key]: val })

  // Drag moves patch several keys at once; one merged object avoids stale
  // closure reads of `overrides` between the two set() calls of a frame.
  function patchOverrides(partial: Partial<BrandOverrides>) {
    onChange({ ...overrides, ...partial })
  }

  function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v))
  }

  /** Half-millimetre steps feel precise but never leave float dust behind. */
  function round05(v: number): number {
    return Math.round(v * 2) / 2
  }

  function pxPerMm(): number {
    return (A4_WIDTH_PX / 210) * scale
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    const onHandle = !!target.closest('[data-drag-handle="logo"]')
    const zone = target.closest('[data-zone]')?.getAttribute('data-zone')
    const mode: DragSession['mode'] | null = onHandle
      ? 'resize'
      : zone === 'seal'
        ? 'seal'
        : zone === 'heading'
          ? 'heading'
          : null
    if (!mode) return
    e.preventDefault()
    draggedRef.current = false
    drag.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      baseWidthMm: eff.logoWidthMm,
      baseOffsetXMm: eff.logoOffsetXMm,
      baseOffsetYMm: eff.logoOffsetYMm,
      baseTopMm: eff.contentTopMm,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const dxPx = e.clientX - d.startX
    const dyPx = e.clientY - d.startY
    if (!draggedRef.current && Math.abs(dxPx) + Math.abs(dyPx) > 4) {
      draggedRef.current = true
    }
    const mmPerPx = pxPerMm()
    if (d.mode === 'seal') {
      patchOverrides({
        logoOffsetXMm: clamp(round05(d.baseOffsetXMm + dxPx / mmPerPx), -80, 80),
        logoOffsetYMm: clamp(round05(d.baseOffsetYMm + dyPx / mmPerPx), -40, 40),
      })
    } else if (d.mode === 'resize') {
      patchOverrides({
        logoWidthMm: clamp(round05(d.baseWidthMm + dxPx / mmPerPx), 20, 120),
      })
    } else {
      patchOverrides({
        contentTopMm: clamp(round05(d.baseTopMm + dyPx / mmPerPx), 5, 80),
      })
    }
  }

  function handlePointerUp() {
    drag.current = null
  }

  const eff = {
    font:               (overrides.font               ?? brand.font)               as BrandConfig['font'],
    accentColor:         overrides.accentColor         ?? brand.accentColor         ?? '#000000',
    border:             (overrides.border              ?? brand.border)             as BrandConfig['border'],
    logoWidthMm:         overrides.logoWidthMm         ?? brand.logoWidthMm         ?? 55,
    logoAlign:          (overrides.logoAlign           ?? brand.logoAlign           ?? 'center') as 'left'|'center'|'right',
    logoOffsetYMm:       overrides.logoOffsetYMm       ?? brand.logoOffsetYMm       ?? 0,
    logoOffsetXMm:       overrides.logoOffsetXMm       ?? brand.logoOffsetXMm       ?? 0,
    borderInsetMm:       overrides.borderInsetMm       ?? brand.borderInsetMm       ?? 14,
    institutionSizePt:   overrides.institutionSizePt   ?? brand.institutionSizePt   ?? 20,
    titleSizePt:         overrides.titleSizePt         ?? brand.titleSizePt         ?? 24,
    detailsSizePt:       overrides.detailsSizePt       ?? brand.detailsSizePt       ?? 20,
    contentTopMm:        overrides.contentTopMm        ?? brand.contentTopMm        ?? 28,
  }

  function handleZoneClick(zoneId: ZoneId) {
    if (active === zoneId && !collapsed) { setCollapsed(true); return }
    setActive(zoneId)
    setCollapsed(false)
  }

  function renderContent() {
    if (active === 'heading') return (
      <Row>
        <Field label="Font size">
          <NumInput value={eff.institutionSizePt} min={8} max={40} unit="pt"
            onChange={(v) => set('institutionSizePt', v)} />
        </Field>
        <Field label="Typeface">
          <SelInput value={eff.font} options={FONT_OPTIONS} labels={FONT_LABELS}
            onChange={(v) => set('font', v)} />
        </Field>
        <Field label="Colour">
          <ColorInput value={eff.accentColor} onChange={(v) => set('accentColor', v)} />
        </Field>
        <Field label="Top offset">
          <NumInput value={eff.contentTopMm} min={5} max={80} unit="mm"
            onChange={(v) => set('contentTopMm', v)} />
        </Field>
      </Row>
    )

    if (active === 'seal') return (
      <Row>
        <Field label="Width">
          <NumInput value={eff.logoWidthMm} min={20} max={120} unit="mm"
            onChange={(v) => set('logoWidthMm', v)} />
        </Field>
        <Field label="Alignment">
          <SelInput value={eff.logoAlign} options={['left','center','right']}
            labels={{ left: 'Left', center: 'Center', right: 'Right' }} width="w-28"
            onChange={(v) => set('logoAlign', v as BrandConfig['logoAlign'])} />
        </Field>
        <Field label="Vertical offset">
          <NumInput value={eff.logoOffsetYMm} min={-40} max={40} unit="mm"
            onChange={(v) => set('logoOffsetYMm', v)} />
        </Field>
        <Field label="Horizontal offset">
          <NumInput value={eff.logoOffsetXMm} min={-80} max={80} unit="mm"
            onChange={(v) => set('logoOffsetXMm', v)} />
        </Field>
      </Row>
    )

    if (active === 'title') return (
      <Row>
        <Field label="Font size">
          <NumInput value={eff.titleSizePt} min={8} max={48} unit="pt"
            onChange={(v) => set('titleSizePt', v)} />
        </Field>
        <Field label="Typeface">
          <SelInput value={eff.font} options={FONT_OPTIONS} labels={FONT_LABELS}
            onChange={(v) => set('font', v)} />
        </Field>
        <Field label="Colour">
          <ColorInput value={eff.accentColor} onChange={(v) => set('accentColor', v)} />
        </Field>
      </Row>
    )

    if (active === 'details') return (
      <Row>
        <Field label="Font size">
          <NumInput value={eff.detailsSizePt} min={8} max={36} unit="pt"
            onChange={(v) => set('detailsSizePt', v)} />
        </Field>
        <Field label="Typeface">
          <SelInput value={eff.font} options={FONT_OPTIONS} labels={FONT_LABELS}
            onChange={(v) => set('font', v)} />
        </Field>
      </Row>
    )

    if (active === 'page') return (
      <Row>
        <Field label="Border">
          <SelInput value={eff.border} options={BORDER_OPTIONS} labels={BORDER_LABELS} width="w-32"
            onChange={(v) => set('border', v)} />
        </Field>
        <Field label="Border margin">
          <NumInput value={eff.borderInsetMm} min={2} max={40} unit="mm"
            onChange={(v) => set('borderInsetMm', v)} />
        </Field>
        <Field label="Ink colour">
          <ColorInput value={eff.accentColor} onChange={(v) => set('accentColor', v)} />
        </Field>
        <Field label="Typeface">
          <SelInput value={eff.font} options={FONT_OPTIONS} labels={FONT_LABELS}
            onChange={(v) => set('font', v)} />
        </Field>
      </Row>
    )

    return null
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Preview: clicks select a region, double-click on text edits it,
          drags move/resize the seal and heading. Layouts tag regions with
          data-zone, values with data-field-key, and the seal's resize
          handle with data-drag-handle in interactive mode. */}
      <div
        ref={pageRef}
        className="relative w-full"
        onClick={handlePreviewClick}
        onDoubleClick={handlePreviewDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {children}
      </div>

      {/* Properties panel */}
      <div className="mt-2 rounded-[3px] border border-rule bg-sheet shadow-sm">
        {/* Tab bar */}
        <div className="flex items-center border-b border-rule">
          <div className="flex flex-1 overflow-x-auto">
            {allTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (active === tab.id) { setCollapsed(!collapsed); return }
                  setActive(tab.id)
                  setCollapsed(false)
                }}
                className={[
                  'shrink-0 px-3 py-2 text-xs font-medium transition-colors',
                  active === tab.id && !collapsed
                    ? 'border-b-2 border-[color:var(--ink)] text-ink'
                    : 'text-pencil hover:text-ink',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="px-3 py-2 text-pencil hover:text-ink"
            title={collapsed ? 'Expand' : 'Collapse'}
            aria-label={collapsed ? 'Expand properties' : 'Collapse properties'}
          >
            <span className="text-xs">{collapsed ? '▲' : '▼'}</span>
          </button>
        </div>

        {/* Content area */}
        {!collapsed && (
          <div className="p-4">
            {renderContent()}
          </div>
        )}
      </div>
    </div>
  )
}
