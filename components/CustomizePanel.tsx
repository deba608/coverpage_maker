'use client'

/* eslint-disable @next/next/no-img-element -- the logo preview is a tiny
 * data-URI or static image; the optimizer buys nothing here. */
import { useRef, useState } from 'react'
import type { BrandConfig } from '@/lib/templates/types'
import { fileToLogoDataUri, hasOverrides, type BrandOverrides } from '@/lib/customize'

const FONT_LABELS: Record<BrandConfig['font'], string> = {
  times: 'Times (classic)',
  serif: 'Serif',
  garamond: 'Garamond',
  sans: 'Sans-serif',
}

const BORDER_LABELS: Record<BrandConfig['border'], string> = {
  double: 'Double line',
  single: 'Single line',
  none: 'No border',
}

const LOGO_ALIGN_LABELS: Record<'left' | 'center' | 'right', string> = {
  left: 'Left',
  center: 'Center',
  right: 'Right',
}

/**
 * The "make it yours" panel: border, ink colour, typeface, seal size, alignment,
 * position, and a replacement seal upload. Everything is an override on top of the
 * template — Reset returns to exactly what the template ships.
 */
export function CustomizePanel({
  brand,
  overrides,
  onChange,
}: {
  brand: BrandConfig
  overrides: BrandOverrides
  onChange: (next: BrandOverrides) => void
}) {
  const [open, setOpen] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof BrandOverrides>(key: K, value: BrandOverrides[K]) =>
    onChange({ ...overrides, [key]: value })

  async function uploadLogo(file: File | undefined) {
    if (!file) return
    setLogoError(null)
    try {
      set('logo', await fileToLogoDataUri(file))
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : 'Could not read that image')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const effective = {
    border: overrides.border ?? brand.border,
    font: overrides.font ?? brand.font,
    accentColor: overrides.accentColor ?? brand.accentColor ?? '#000000',
    logoWidthMm: overrides.logoWidthMm ?? brand.logoWidthMm ?? 55,
    logoAlign: (overrides.logoAlign ?? brand.logoAlign ?? 'center') as 'left' | 'center' | 'right',
    logoOffsetYMm: overrides.logoOffsetYMm ?? brand.logoOffsetYMm ?? 0,
    logo: overrides.logo ?? brand.logo,
    borderInsetMm: overrides.borderInsetMm ?? brand.borderInsetMm ?? 14,
    institutionSizePt: overrides.institutionSizePt ?? brand.institutionSizePt ?? 20,
    titleSizePt: overrides.titleSizePt ?? brand.titleSizePt ?? 24,
    detailsSizePt: overrides.detailsSizePt ?? brand.detailsSizePt ?? 20,
    contentTopMm: overrides.contentTopMm ?? brand.contentTopMm ?? 28,
  }

  return (
    <div className="mt-6 border-t border-rule pt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-pencil">
          Customize the page
        </span>
        <span className="text-sm text-pencil" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink">Border</span>
            <select
              className="field-input"
              value={effective.border}
              onChange={(e) => set('border', e.target.value as BrandConfig['border'])}
            >
              {(Object.keys(BORDER_LABELS) as BrandConfig['border'][]).map((b) => (
                <option key={b} value={b}>
                  {BORDER_LABELS[b]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink">Typeface</span>
            <select
              className="field-input"
              value={effective.font}
              onChange={(e) => set('font', e.target.value as BrandConfig['font'])}
            >
              {(Object.keys(FONT_LABELS) as BrandConfig['font'][]).map((f) => (
                <option key={f} value={f}>
                  {FONT_LABELS[f]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink">Ink colour</span>
            <input
              type="color"
              value={effective.accentColor}
              onChange={(e) => set('accentColor', e.target.value)}
              className="h-8 w-14 cursor-pointer rounded-[2px] border border-rule bg-sheet p-0.5"
              aria-label="Ink colour"
            />
          </label>

          {/* Seal / Logo customizer section */}
          <div className="rounded-[2px] border border-rule/60 bg-sheet/40 p-3 space-y-3">
            <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-pencil">
              Seal / Logo
            </span>

            <div>
              <span className="mb-1 block text-xs font-medium text-ink">Image</span>
              <div className="flex items-center gap-3">
                {effective.logo ? (
                  <img
                    src={effective.logo}
                    alt=""
                    className="h-12 w-12 rounded-[2px] border border-rule bg-sheet object-contain"
                  />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-[2px] border border-dashed border-rule text-[0.625rem] text-pencil">
                    none
                  </span>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost text-xs" onClick={() => fileRef.current?.click()}>
                    {effective.logo ? 'Replace image' : 'Upload image'}
                  </button>
                  {effective.logo && (
                    <button
                      type="button"
                      className="btn-ghost text-xs text-margin"
                      onClick={() => set('logo', '')}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => uploadLogo(e.target.files?.[0])}
                />
              </div>
              {logoError && <p className="mt-1 text-xs text-margin">{logoError}</p>}
            </div>

            <label className="block">
              <span className="mb-1 flex justify-between text-xs font-medium text-ink">
                <span>Logo size (width)</span>
                <span className="tabular-nums text-pencil">{effective.logoWidthMm}mm</span>
              </span>
              <input
                type="range"
                min={20}
                max={120}
                step={1}
                value={effective.logoWidthMm}
                onChange={(e) => set('logoWidthMm', Number(e.target.value))}
                className="w-full accent-[var(--ink)]"
              />
            </label>

            <div>
              <span className="mb-1 block text-xs font-medium text-ink">Logo alignment</span>
              <div className="grid grid-cols-3 gap-2">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => set('logoAlign', align)}
                    className={`rounded-[2px] border px-2 py-1 text-xs font-medium transition-colors ${
                      effective.logoAlign === align
                        ? 'border-ink bg-ink text-sheet'
                        : 'border-rule bg-sheet text-ink hover:border-pencil'
                    }`}
                  >
                    {LOGO_ALIGN_LABELS[align]}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 flex justify-between text-xs font-medium text-ink">
                <span>Logo vertical position</span>
                <span className="tabular-nums text-pencil">
                  {effective.logoOffsetYMm > 0 ? `+${effective.logoOffsetYMm}` : effective.logoOffsetYMm}mm
                </span>
              </span>
              <input
                type="range"
                min={-40}
                max={40}
                step={1}
                value={effective.logoOffsetYMm}
                onChange={(e) => set('logoOffsetYMm', Number(e.target.value))}
                className="w-full accent-[var(--ink)]"
              />
            </label>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-ink">Border margin (mm from page edge)</span>
            <div className="grid grid-cols-2 gap-2">
              {(['Top', 'Bottom', 'Left', 'Right'] as const).map((side) => (
                <label key={side} className="flex items-center gap-2 text-xs text-ink">
                  <span className="w-10 shrink-0">{side}</span>
                  <input
                    type="number"
                    min={2}
                    max={40}
                    step={1}
                    value={effective.borderInsetMm}
                    onChange={(e) => set('borderInsetMm', Math.max(2, Math.min(40, Number(e.target.value))))}
                    className="ink-input w-full"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-ink">Font sizes (pt)</span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { label: 'Heading', key: 'institutionSizePt', min: 8, max: 40 },
                  { label: 'Title', key: 'titleSizePt', min: 8, max: 48 },
                  { label: 'Details', key: 'detailsSizePt', min: 8, max: 36 },
                ] as const
              ).map(({ label, key, min, max }) => (
                <label key={key} className="flex flex-col gap-1 text-xs text-ink">
                  <span>{label}</span>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={1}
                    value={effective[key]}
                    onChange={(e) => set(key, Math.max(min, Math.min(max, Number(e.target.value))))}
                    className="ink-input w-full"
                  />
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 flex justify-between text-xs font-medium text-ink">
              <span>Content top position (mm)</span>
              <span className="tabular-nums text-pencil">{effective.contentTopMm}mm</span>
            </span>
            <input
              type="range"
              min={5}
              max={80}
              step={1}
              value={effective.contentTopMm}
              onChange={(e) => set('contentTopMm', Number(e.target.value))}
              className="w-full accent-[var(--ink)]"
            />
          </label>

          {hasOverrides(overrides) && (
            <button type="button" className="btn-ghost" onClick={() => onChange({})}>
              Reset to template
            </button>
          )}
        </div>
      )}
    </div>
  )
}
