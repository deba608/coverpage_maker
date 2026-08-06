/**
 * Dev smoke test for the importer: uploads a real coverpage PDF on /import,
 * screenshots the guessed editor, saves, and confirms the template appears on
 * the shelf. node scripts/import-check.mjs <coverpage.pdf> <shot-prefix>
 */
import puppeteer from 'puppeteer'

const [, , pdfPath, prefix = 'import'] = process.argv

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 1000 })
await page.goto('http://localhost:3000/import', { waitUntil: 'networkidle0' })

const input = await page.$('input[type=file]')
await input.uploadFile(pdfPath)
await page.waitForSelector('button.btn-ink', { timeout: 30000 })
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: `${prefix}-editor.png`, fullPage: false })
console.log(`editor: ${prefix}-editor.png`)

// What did it guess?
const guessed = await page.evaluate(() => ({
  institutionLines: [...document.querySelectorAll('input[aria-label^="Institution"]')].map((i) => i.value),
  address: document.querySelector('input[aria-label="Address"]')?.value,
  fieldLabels: [...document.querySelectorAll('input[aria-label="Field label"]')].map((i) => i.value),
  hasLogo: !!document.querySelector('img[alt="College seal"]'),
  saveDisabled: [...document.querySelectorAll('button.btn-ink')].at(-1)?.disabled,
}))
console.log(JSON.stringify(guessed, null, 2))

// Save and confirm it shows up on the shelf.
const buttons = await page.$$('button.btn-ink')
await buttons[buttons.length - 1].click()
await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {})
await new Promise((r) => setTimeout(r, 800))
const shelf = await page.evaluate(() =>
  [...document.querySelectorAll('[aria-label="Templates"] p')].map((p) => p.textContent),
)
console.log(`shelf after save: ${JSON.stringify(shelf)}`)
await page.screenshot({ path: `${prefix}-home.png` })
console.log(`home: ${prefix}-home.png`)

await browser.close()
