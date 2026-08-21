/* eslint-disable @next/next/no-img-element -- next/image needs the runtime;
 * layouts must render via renderToStaticMarkup in the PDF route. */
import type { LayoutProps } from '@/lib/templates/types'
import { fieldsInSlot } from '@/lib/templates/types'
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
export function ClassicSeal({ brand, fields, values }: LayoutProps) {
  const title = fieldsInSlot(fields, 'title')[0]
  const subtitle = fieldsInSlot(fields, 'subtitle')[0]
  const details = fieldsInSlot(fields, 'details')

  const show = (key: string | undefined, placeholder: string) => {
    const v = key ? values[key]?.trim() : undefined
    return v ? (
      v
    ) : (
      <span className="cs-placeholder">{placeholder}</span>
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
        {brand.institution.map((line) => (
          <h1 className="cs-institution" key={line}>
            {line}
          </h1>
        ))}
        {brand.address && <p className="cs-address">{brand.address}</p>}

        <div className="cs-logo-band">
          {brand.logo && <img className="cs-logo" src={brand.logo} alt="" />}
        </div>

        {title && (
          <p className={`cs-title${fit(title.key, 26, 36)}`}>
            {show(title.key, `[${title.label}]`)}
          </p>
        )}
        {subtitle && (
          <p className={`cs-subtitle${fit(subtitle.key, 26, 36)}`}>
            {show(subtitle.key, `[${subtitle.label}]`)}
          </p>
        )}

        {details.length > 0 && (
          <div className="cs-details">
            <p className="cs-details-heading">Submitted By :-</p>
            <table className="cs-details-table">
              <tbody>
                {details.map((f) => (
                  <tr key={f.key}>
                    <td className="cs-details-label">{f.label}</td>
                    <td className="cs-details-colon">:</td>
                    <td className={`cs-details-value${fit(f.key, 18, 26)}`}>
                      {show(f.key, `[${f.label}]`)}
                    </td>
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
