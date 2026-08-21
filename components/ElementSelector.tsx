'use client'

import { useEffect, useRef, useState } from 'react'
import type { BrandConfig } from '@/lib/templates/types'
import type { BrandOverrides } from '@/lib/customize'

/** A4 at 96dpi */
const A4_H = 1123

/**
 * Click zones — y ranges in unscaled A4 pixels.
 * Tuned against classic-seal's 28mm top padding and flex logo band.
 */
const ZONES = [
  { id: 'institution', label: 'Heading', y0: 0, y1: 230 },
  { id: 'seal', label: 'Seal', y0: 230, y1: 700 },
  { id: 'title', label: 'Title / Lab name', y0: 700, y1: 840 },
  { id: 'details', label: 'Details box', y0: 840, y1: A4_H },
] as const

type ZoneId = (typeof ZONES)[number]['id']

const FONT_LABELS: Record<BrandConfig['font'], string> = {
  times: 'Times',
  serif: 'Serif',
  garamond: 'Garamond',
  sans: 'Sans-serif',
}

const BORDER_LABELS: Record<BrandConfig['border'], string> = {
  double: 'Double',
  single: 'Single',
  none: 'None',
}

interface Props {
  brand: BrandConfig
  overrides: BrandOverrides
  onChange: (next: BrandOverrides) => void
  children: React.ReactNode
  scale: number
}

function Num({
  label, value, min, max, step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-pencil">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="w-14 rounded border border-rule bg-sheet px-1 py-0.5 text-center text-xs text-ink"
      />
    </label>
  )
}

function Sel<T extends string>({
  label, value, options, labels, onChange,
}: {
  label: string
  value: T
  options: T[]
  labels: Record<T, string>
  onChange: (v: T) => void
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-pencil">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-rule bg-sheet px-1 py-0.5 text-xs text-ink"
      >
        {options.map((o) => (
          <option key={o} value={o}>{labels[o]}</option>
        ))}
      </select>
    </label>
  )
}

function ColorBtn({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-pencil">Colour</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 cursor-pointer rounded border border-rule bg-sheet p-0.5"
      />
    </label>
  )
}

function Divider() {
  return <div className="h-8 w-px bg-rule" />
}

export function ElementSelector({ brand, overrides, onChange, children, scale }: Props) {
  const [active, setActive] = useState<ZoneId | null>(null)
  const [toolbarY, setToolbarY] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [active])

  const set = <K extends keyof BrandOverrides>(key: K, value: BrandOverrides[K]) =>
    onChange({ ...overrides, [key]: value })

  const eff = {
    font: overrides.font ?? brand.font,
    accentColor: overrides.accentColor ?? brand.accentColor ?? '#000000',
    border: overrides.border ?? brand.border,
    logoWidthMm: overrides.logoWidthMm ?? brand.logoWidthMm ?? 55,
    borderInsetMm: overrides.borderInsetMm ?? brand.borderInsetMm ?? 14,
    institutionSizePt: overrides.institutionSizePt ?? brand.institutionSizePt ?? 20,
    titleSizePt: overrides.titleSizePt ?? brand.titleSizePt ?? 24,
    detailsSizePt: overrides.detailsSizePt ?? brand.detailsSizePt ?? 20,
    contentTopMm: overrides.contentTopMm ?? brand.contentTopMm ?? 28,
  }

  function handleZoneClick(zone: (typeof ZONES)[number], e: React.MouseEvent) {
    e.stopPropagation()
    const midY = ((zone.y0 + zone.y1) / 2) * scale
    setToolbarY(midY)
    setActive((prev) => (prev === zone.id ? null : zone.id))
  }

  function renderToolbar() {
    if (!active) return null
    const items: React.ReactNode[] = []

    if (active === 'institution') {
      items.push(
        <Num key="isize" label="Size (pt)" value={eff.institutionSizePt} min={8} max={40}
          onChange={(v) => set('institutionSizePt', v)} />,
        <Divider key="d1" />,
        <Sel key="font" label="Font" value={eff.font}
          options={['times', 'serif', 'garamond', 'sans'] as BrandConfig['font'][]}
          labels={FONT_LABELS} onChange={(v) => set('font', v)} />,
        <Divider key="d2" />,
        <ColorBtn key="color" value={eff.accentColor} onChange={(v) => set('accentColor', v)} />,
        <Divider key="d3" />,
        <Num key="top" label="Top pos (mm)" value={eff.contentTopMm} min={5} max={80}
          onChange={(v) => set('contentTopMm', v)} />,
      )
    }

    if (active === 'seal') {
      items.push(
        <Num key="seal" label="Seal size (mm)" value={eff.logoWidthMm} min={20} max={100}
          onChange={(v) => set('logoWidthMm', v)} />,
      )
    }

    if (active === 'title') {
      items.push(
        <Num key="tsize" label="Size (pt)" value={eff.titleSizePt} min={8} max={48}
          onChange={(v) => set('titleSizePt', v)} />,
        <Divider key="d1" />,
        <Sel key="font" label="Font" value={eff.font}
          options={['times', 'serif', 'garamond', 'sans'] as BrandConfig['font'][]}
          labels={FONT_LABELS} onChange={(v) => set('font', v)} />,
        <Divider key="d2" />,
        <ColorBtn key="color" value={eff.accentColor} onChange={(v) => set('accentColor', v)} />,
      )
    }

    if (active === 'details') {
      items.push(
        <Num key="dsize" label="Size (pt)" value={eff.detailsSizePt} min={8} max={36}
          onChange={(v) => set('detailsSizePt', v)} />,
        <Divider key="d1" />,
        <Sel key="font" label="Font" value={eff.font}
          options={['times', 'serif', 'garamond', 'sans'] as BrandConfig['font'][]}
          labels={FONT_LABELS} onChange={(v) => set('font', v)} />,
      )
    }

    // Always: border controls
    items.push(
      <Divider key="dborder" />,
      <Sel key="border" label="Border" value={eff.border}
        options={['double', 'single', 'none'] as BrandConfig['border'][]}
        labels={BORDER_LABELS} onChange={(v) => set('border', v)} />,
      <Num key="inset" label="Margin (mm)" value={eff.borderInsetMm} min={2} max={40}
        onChange={(v) => set('borderInsetMm', v)} />,
    )

    // Position toolbar above or below mid-point to stay in view
    const above = toolbarY > 300 * scale
    const toolbarStyle: React.CSSProperties = above
      ? { bottom: `calc(100% - ${toolbarY}px + 8px)` }
      : { top: `${toolbarY}px` }

    return (
      <div
        className="absolute left-1/2 z-20 -translate-x-1/2 rounded-[3px] border border-rule bg-sheet px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
        style={toolbarStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-pencil">
          {ZONES.find((z) => z.id === active)?.label}
        </div>
        <div className="flex items-end gap-3">{items}</div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {children}

      {/* Click zones — transparent overlay on top of the scaled preview */}
      <div className="pointer-events-none absolute inset-0">
        {ZONES.map((zone) => {
          const top = zone.y0 * scale
          const height = (zone.y1 - zone.y0) * scale
          const isActive = active === zone.id
          return (
            <div
              key={zone.id}
              className="pointer-events-auto absolute left-0 right-0 cursor-pointer transition-colors"
              style={{
                top,
                height,
                background: isActive ? 'rgba(66,133,244,0.08)' : 'transparent',
                outline: isActive ? '2px solid rgba(66,133,244,0.5)' : 'none',
                outlineOffset: '-2px',
              }}
              onClick={(e) => handleZoneClick(zone, e)}
              title={`Click to edit: ${zone.label}`}
            />
          )
        })}
      </div>

      {renderToolbar()}
    </div>
  )
}
