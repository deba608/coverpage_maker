import type { BrandConfig, TemplateMeta } from '@/lib/templates/types'

/**
 * User tweaks layered over a template's brand config. Every key is optional —
 * only what the user actually changed is stored, so a template update still
 * shows through everywhere the user didn't override it.
 *
 * `logo` may be a data URI (uploaded in the browser); the render route already
 * accepts those on the inline-meta path.
 */
export interface BrandOverrides {
  border?: BrandConfig['border']
  font?: BrandConfig['font']
  accentColor?: string
  logoWidthMm?: number
  logoAlign?: BrandConfig['logoAlign']
  logoOffsetYMm?: number
  logo?: string
  /** Distance from page edge to outer border line in mm (2–40). Default 14. */
  borderInsetMm?: number
  institutionSizePt?: number
  titleSizePt?: number
  detailsSizePt?: number
  contentTopMm?: number
}

/** localStorage record: templateId → that template's overrides. */
export type OverridesByTemplate = Record<string, BrandOverrides>

export function hasOverrides(o: BrandOverrides | undefined): boolean {
  return !!o && Object.values(o).some((v) => v !== undefined)
}

/** Applies overrides to a template, returning a new meta the layout can render. */
export function applyOverrides(meta: TemplateMeta, o: BrandOverrides | undefined): TemplateMeta {
  if (!hasOverrides(o)) return meta
  const brand: BrandConfig = { ...meta.brand }
  if (o!.border) brand.border = o!.border
  if (o!.font) brand.font = o!.font
  if (o!.accentColor) brand.accentColor = o!.accentColor
  if (o!.logoWidthMm !== undefined) brand.logoWidthMm = o!.logoWidthMm
  if (o!.logoAlign !== undefined) brand.logoAlign = o!.logoAlign
  if (o!.logoOffsetYMm !== undefined) brand.logoOffsetYMm = o!.logoOffsetYMm
  if (o!.logo) brand.logo = o!.logo
  if (o!.borderInsetMm !== undefined) brand.borderInsetMm = o!.borderInsetMm
  if (o!.institutionSizePt !== undefined) brand.institutionSizePt = o!.institutionSizePt
  if (o!.titleSizePt !== undefined) brand.titleSizePt = o!.titleSizePt
  if (o!.detailsSizePt !== undefined) brand.detailsSizePt = o!.detailsSizePt
  if (o!.contentTopMm !== undefined) brand.contentTopMm = o!.contentTopMm
  return { ...meta, brand }
}

/**
 * Reads an uploaded image, downscales it to fit maxPx, and returns a PNG data
 * URI small enough for the render route's 1MB asset cap. Rejects on anything
 * that isn't a decodable image.
 */
export function fileToLogoDataUri(file: File, maxPx = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas unavailable'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const uri = canvas.toDataURL('image/png')
      if (uri.length > 1_000_000) {
        return reject(new Error('Logo is too detailed even after resizing — try a simpler image'))
      }
      resolve(uri)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file is not a readable image'))
    }
    img.src = url
  })
}
