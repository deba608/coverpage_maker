'use client'

/**
 * Browser-side half of the template importer: opens a coverpage PDF with
 * pdfjs, extracts every text item in millimetres, and pulls out the largest
 * embedded image (almost always the seal) as a data URI.
 *
 * This is the client twin of scripts/inspect-pdf.mjs — same coordinate maths,
 * same origin flip, running on the user's file without it ever leaving their
 * machine.
 */

const PT_PER_MM = 72 / 25.4

export interface TextItem {
  text: string
  xMm: number
  yMm: number
  widthMm: number
  sizePt: number
}

export interface ParsedPdf {
  pageWidthMm: number
  pageHeightMm: number
  items: TextItem[]
  /** Largest embedded image as a PNG data URI, if one was recoverable. */
  logo?: string
}

export async function parsePdf(file: File): Promise<ParsedPdf> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const page = await doc.getPage(1)
  const [, , widthPt, heightPt] = page.view

  const content = await page.getTextContent()
  const items: TextItem[] = content.items
    .filter(
      (i): i is import('pdfjs-dist/types/src/display/api').TextItem =>
        'str' in i && i.str.trim() !== '',
    )
    .map((i) => {
      const [a, , , d, x, y] = i.transform
      return {
        text: i.str.trim(),
        xMm: x / PT_PER_MM,
        // PDF origin is bottom-left; flip to top-left to match CSS.
        yMm: (heightPt - y) / PT_PER_MM,
        widthMm: i.width / PT_PER_MM,
        sizePt: Math.abs(d || a),
      }
    })
    .sort((p, q) => p.yMm - q.yMm || p.xMm - q.xMm)

  return {
    pageWidthMm: widthPt / PT_PER_MM,
    pageHeightMm: heightPt / PT_PER_MM,
    items,
    logo: await extractLargestImage(page),
  }
}

/**
 * Walks the page's operator list for painted images and returns the largest
 * as a data URI. pdfjs resolves image XObjects into ImageBitmap/typed-array
 * objects; a canvas round-trip turns either into a PNG.
 */
async function extractLargestImage(
  page: import('pdfjs-dist').PDFPageProxy,
): Promise<string | undefined> {
  try {
    const OPS = (await import('pdfjs-dist')).OPS
    const ops = await page.getOperatorList()
    const names: string[] = []
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] === OPS.paintImageXObject) {
        const arg = ops.argsArray[i]?.[0]
        if (typeof arg === 'string') names.push(arg)
      }
    }

    let best: { area: number; dataUri: string } | undefined
    for (const name of names) {
      const img = await new Promise<unknown>((resolve) => {
        try {
          page.objs.get(name, resolve)
        } catch {
          resolve(undefined)
        }
      })
      if (!img || typeof img !== 'object') continue
      const dataUri = await imageObjectToPng(img as PdfImageLike)
      if (!dataUri) continue
      const { width = 0, height = 0 } = img as PdfImageLike
      const area = width * height
      if (!best || area > best.area) best = { area, dataUri }
    }
    return best?.dataUri
  } catch {
    return undefined // no image is fine — the editor offers a manual upload
  }
}

interface PdfImageLike {
  width?: number
  height?: number
  bitmap?: ImageBitmap
  data?: Uint8ClampedArray | Uint8Array
}

async function imageObjectToPng(img: PdfImageLike): Promise<string | undefined> {
  const { width, height } = img
  if (!width || !height) return undefined

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined

  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0)
  } else if (img.data) {
    const channels = Math.round(img.data.length / (width * height))
    const rgba = new Uint8ClampedArray(width * height * 4)
    for (let p = 0; p < width * height; p++) {
      if (channels >= 3) {
        rgba[p * 4] = img.data[p * channels]
        rgba[p * 4 + 1] = img.data[p * channels + 1]
        rgba[p * 4 + 2] = img.data[p * channels + 2]
        rgba[p * 4 + 3] = channels === 4 ? img.data[p * channels + 3] : 255
      } else {
        const g = img.data[p]
        rgba[p * 4] = rgba[p * 4 + 1] = rgba[p * 4 + 2] = g
        rgba[p * 4 + 3] = 255
      }
    }
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0)
  } else {
    return undefined
  }

  return canvas.toDataURL('image/png')
}
