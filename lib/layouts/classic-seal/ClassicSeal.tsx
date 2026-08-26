/* eslint-disable @next/next/no-img-element -- next/image needs the runtime;
 * layouts must render via renderToStaticMarkup in the PDF route. */
import type { FieldDef, LayoutProps } from '@/lib/templates/types'
import { fieldsInSlot } from '@/lib/templates/types'
import { focusAndSelect } from '@/lib/inlineEdit'
import './classic-seal.css'

// Tinos leads the serif stacks: it is metric-compatible with Times New Roman
// and self-hosted, so dev machines, the preview, and the Vercel lambda (which
// has no MS fonts at all) all shape text identically.
const FONT_STACKS: Record<string, string> = {
  times: "'Tinos', 'Times New Roman', Times, serif",
  serif: "'Tinos', Georgia, 'Times New Roman', serif",
  sans: 'Arial, Helvetica, sans-serif',
  garamond: "Garamond, 'EB Garamond', 'Tinos', serif",
}

const LOGO_ALIGN_JUSTIFY: Record<'left' | 'center' | 'right', string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
}

/**
 * Centred institution block, seal, document title, and a boxed "Submitted By"
 * details table. The classic Indian college coverpage.
 *
 * Pure function of its props — no hooks, no browser APIs — because the PDF
 * route renders it with renderToStaticMarkup on the server.
 */
export function ClassicSeal({
  brand,
  fields,
  values,
  interactive,
  editingKey,
  onCommitEdit,
  onCancelEdit,
}: LayoutProps) {
  const title = fieldsInSlot(fields, 'title')[0]
  const subtitle = fieldsInSlot(fields, 'subtitle')[0]
  const details = fieldsInSlot(fields, 'details')

  /**
   * Props for one field-value node. Interactive mode tags every value with
   * data-field-key (the double-click target); the field being edited also
   * becomes a contentEditable. Handlers are plain DOM callbacks — no hooks —
   * so the layout keeps its renderToStaticMarkup purity contract.
   */
  const valueProps = (field: FieldDef) => {
    if (!interactive) return {}
    const editing = interactive && editingKey === field.key
    const base: Record<string, unknown> = { 'data-field-key': field.key }
    if (!editing) return base

    return {
      ...base,
      'data-editing': 'true',
      contentEditable: true,
      suppressContentEditableWarning: true,
      ref: focusAndSelect,
      onBlur: (e: React.FocusEvent<HTMLSpanElement>) => {
        const el = e.currentTarget
        if (el.dataset.cancelled) {
          delete el.dataset.cancelled
          onCancelEdit?.()
          return
        }
        onCommitEdit?.(field.key, (el.textContent ?? '').trim())
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLSpanElement>) => {
        // Enter must not inject a newline into a single-line value.
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur() // routes through the single commit path
        }
        if (e.key === 'Escape') {
          // Flag read by onBlur so the typed junk is discarded, not committed
          // by the blur that removing the editor triggers.
          e.currentTarget.dataset.cancelled = 'true'
          e.currentTarget.blur()
        }
      },
    }
  }

  const show = (field: FieldDef) => {
    const v = values[field.key]?.trim()
    return v ? (
      <span {...valueProps(field)}>{v}</span>
    ) : (
      <span className="cs-placeholder" {...valueProps(field)}>
        [{field.label}]
      </span>
    )
  }

  // SSR can't measure text, so long values step the font down by character
  // count instead of overflowing their box. Thresholds tuned against Tinos at
  // the details box's 95mm value column and the full-width title line.
  const fit = (key: string | undefined, mid: number, long: number) => {
    const len = (key ? values[key]?.trim() : '')?.length ?? 0
    return len > long ? ' cs-fit-sm' : len > mid ? ' cs-fit-md' : ''
  }

  return (
    <div
      className="cs-page"
      data-border={brand.border}
      data-interactive={interactive ? '' : undefined}
      style={
        {
          '--cs-font': FONT_STACKS[brand.font] ?? FONT_STACKS.times,
          '--cs-accent': brand.accentColor ?? '#000',
          '--cs-logo-width': `${brand.logoWidthMm ?? 55}mm`,
          '--cs-logo-align': LOGO_ALIGN_JUSTIFY[brand.logoAlign ?? 'center'] ?? 'center',
          '--cs-logo-offset-y': `${brand.logoOffsetYMm ?? 0}mm`,
          '--cs-border-inset': `${brand.borderInsetMm ?? 14}mm`,
          '--cs-institution-size': brand.institutionSizePt ? `${brand.institutionSizePt}pt` : undefined,
          '--cs-title-size': brand.titleSizePt ? `${brand.titleSizePt}pt` : undefined,
          '--cs-details-size': brand.detailsSizePt ? `${brand.detailsSizePt}pt` : undefined,
          '--cs-content-top': brand.contentTopMm ? `${brand.contentTopMm}mm` : undefined,
        } as React.CSSProperties
      }
    >
      <div className="cs-border" />
      <div className="cs-content">
        {/* data-zone tags drive click-to-edit in the preview (interactive
            mode only); the PDF renders without them. Subtitle shares the
            title tab — the panel controls are identical. */}
        <div data-zone="heading">
          {brand.institution.map((line, i) => (
            // Index key: two identical lines are legal and would collide on key={line}.
            <h1 className="cs-institution" key={i}>
              {line}
            </h1>
          ))}
          {brand.address && <p className="cs-address">{brand.address}</p>}
        </div>

        <div className="cs-logo-band" data-zone="seal">
          {brand.logo && <img className="cs-logo" src={brand.logo} alt="" />}
        </div>

        {title && (
          <p className={`cs-title${fit(title.key, 26, 36)}`} data-zone="title">
            {show(title)}
          </p>
        )}
        {subtitle && (
          <p className={`cs-subtitle${fit(subtitle.key, 26, 36)}`} data-zone="title">
            {show(subtitle)}
          </p>
        )}

        {details.length > 0 && (
          <div className="cs-details" data-zone="details">
            <p className="cs-details-heading">Submitted By :-</p>
            <table className="cs-details-table">
              <tbody>
                {details.map((f) => (
                  <tr key={f.key}>
                    <td className="cs-details-label">{f.label}</td>
                    <td className="cs-details-colon">:</td>
                    <td className={`cs-details-value${fit(f.key, 18, 26)}`}>{show(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
