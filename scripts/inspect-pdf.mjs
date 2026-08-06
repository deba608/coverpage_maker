/**
 * Dumps every text item in a PDF with its position, font, and size.
 *
 * Used when rebuilding a source coverpage as a layout: the coordinates tell you
 * exactly where things sit, in millimetres, so the CSS is measurement rather
 * than guesswork. Also the seed of the future template importer.
 *
 *   node scripts/inspect-pdf.mjs <file.pdf>
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync } from 'node:fs'

const PT_PER_MM = 72 / 25.4

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/inspect-pdf.mjs <file.pdf>')
  process.exit(1)
}

const doc = await getDocument({
  data: new Uint8Array(readFileSync(file)),
  useSystemFonts: true,
}).promise

console.log(`pages: ${doc.numPages}`)

for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n)
  const [, , widthPt, heightPt] = page.view

  console.log(
    `\n=== page ${n} — ${(widthPt / PT_PER_MM).toFixed(1)} x ${(heightPt / PT_PER_MM).toFixed(1)} mm ` +
      `(${widthPt.toFixed(1)} x ${heightPt.toFixed(1)} pt) ===`,
  )

  const content = await page.getTextContent()
  const styles = content.styles ?? {}

  const items = content.items
    .filter((i) => 'str' in i && i.str.trim() !== '')
    .map((i) => {
      const [a, , , d, x, y] = i.transform
      return {
        text: i.str,
        // PDF origin is bottom-left; flip to top-left so it matches CSS.
        xMm: x / PT_PER_MM,
        yMm: (heightPt - y) / PT_PER_MM,
        widthMm: i.width / PT_PER_MM,
        sizePt: Math.abs(d || a),
        font: styles[i.fontName]?.fontFamily ?? i.fontName,
      }
    })
    .sort((p, q) => p.yMm - q.yMm || p.xMm - q.xMm)

  console.log('\n  y(mm)   x(mm)   w(mm)  size  font                 text')
  for (const i of items) {
    console.log(
      `  ${i.yMm.toFixed(1).padStart(6)} ${i.xMm.toFixed(1).padStart(6)} ` +
        `${i.widthMm.toFixed(1).padStart(6)} ${i.sizePt.toFixed(1).padStart(5)}  ` +
        `${String(i.font).padEnd(20).slice(0, 20)} ${i.text}`,
    )
  }

  // Vector ops and embedded images, so borders and the seal can be located too.
  const ops = await page.getOperatorList()
  const imageNames = new Set()
  for (let k = 0; k < ops.fnArray.length; k++) {
    // 85 = paintImageXObject, 86 = paintInlineImageXObject
    if (ops.fnArray[k] === 85 || ops.fnArray[k] === 86) {
      const arg = ops.argsArray[k]?.[0]
      if (typeof arg === 'string') imageNames.add(arg)
    }
  }
  console.log(`\n  embedded images: ${imageNames.size ? [...imageNames].join(', ') : 'none'}`)
}
