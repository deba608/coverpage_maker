'use client'

import { useState } from 'react'
import type { BrandConfig } from '@/lib/templates/types'
import type { BrandOverrides } from '@/lib/customize'

/** A4 at 96dpi */
const A4_H = 1123

const ZONES = [
  { id: 'heading',  label: 'Heading', y0: 0,    y1: 230  },
  { id: 'seal',     label: 'Seal',    y0: 230,  y1: 700  },
  { id: 'title',    label: 'Title',   y0: 700,  y1: 840  },
  { id: 'details',  label: 'Details', y0: 840,  y1: A4_H },
] as const

type ZoneId = (typeof ZONES)[number]['id'] | 'page'

const TABS: { id: ZoneId; label: string }[] = [
  { id: 'heading', label: 'Heading' },
  { id: 'seal',    label: 'Seal'    },
  { id: 'title',   label: 'Title'   },
  { id: 'details', label: 'Details' },
  { id: 'page',    label: 'Page'    },
]

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
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
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

export function ElementSelector({ brand, overrides, onChange, children, scale }: Props) {
  const [active, setActive] = useState<ZoneId>('heading')
  const [collapsed, setCollapsed] = useState(false)

  const set = <K extends keyof BrandOverrides>(key: K, val: BrandOverrides[K]) =>
    onChange({ ...overrides, [key]: val })

  const eff = {
    font:               (overrides.font               ?? brand.font)               as BrandConfig['font'],
    accentColor:         overrides.accentColor         ?? brand.accentColor         ?? '#000000',
    border:             (overrides.border              ?? brand.border)             as BrandConfig['border'],
    logoWidthMm:         overrides.logoWidthMm         ?? brand.logoWidthMm         ?? 55,
    logoAlign:          (overrides.logoAlign           ?? brand.logoAlign           ?? 'center') as 'left'|'center'|'right',
    logoOffsetYMm:       overrides.logoOffsetYMm       ?? brand.logoOffsetYMm       ?? 0,
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
      {/* Preview with transparent click zones */}
      <div className="relative w-full">
        {children}
        <div className="pointer-events-none absolute inset-0">
          {ZONES.map((zone) => {
            const top = zone.y0 * scale
            const height = (zone.y1 - zone.y0) * scale
            const isActive = active === zone.id && !collapsed
            return (
              <div
                key={zone.id}
                className="pointer-events-auto absolute left-0 right-0 cursor-pointer"
                style={{
                  top, height,
                  background: isActive ? 'rgba(59,130,246,0.07)' : 'transparent',
                  outline: isActive ? '2px solid rgba(59,130,246,0.4)' : 'none',
                  outlineOffset: '-2px',
                  transition: 'background 150ms, outline 150ms',
                }}
                onClick={() => handleZoneClick(zone.id)}
                title={`Edit ${zone.label}`}
              />
            )
          })}
        </div>
      </div>

      {/* Properties panel */}
      <div className="mt-2 rounded-[3px] border border-rule bg-sheet shadow-sm">
        {/* Tab bar */}
        <div className="flex items-center border-b border-rule">
          <div className="flex flex-1 overflow-x-auto">
            {TABS.map((tab) => (
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
