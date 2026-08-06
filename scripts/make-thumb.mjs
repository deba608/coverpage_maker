/**
 * Renders a template's picker thumbnail from the dev preview page.
 *
 *   node scripts/make-thumb.mjs <templateId>   (dev server must be running)
 */
import puppeteer from 'puppeteer'

const id = process.argv[2]
if (!id) {
  console.error('usage: node scripts/make-thumb.mjs <templateId>')
  process.exit(1)
}

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
// 0.35 scale: A4 at 96dpi is 794px wide, so the thumb lands at ~278px.
await page.setViewport({ width: 900, height: 1300, deviceScaleFactor: 0.35 })
await page.goto(`http://localhost:3000/dev/preview?template=${id}`, { waitUntil: 'networkidle0' })
const el = await page.$('.cs-page, [data-page]')
if (!el) {
  console.error('no page element found')
  process.exit(1)
}
const out = `public/templates/${id}/thumb.png`
await el.screenshot({ path: out })
await browser.close()
console.log(out)
