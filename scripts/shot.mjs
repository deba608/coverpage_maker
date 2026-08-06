/** Dev helper: screenshot a page at A4 pixel size. node scripts/shot.mjs <url> <out.png> */
import puppeteer from 'puppeteer'

const [, , url, out] = process.argv
const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 900, height: 1400, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'networkidle0' })
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log(out)
