/**
 * Visual regression for every registered template.
 *
 * Screenshots /dev/preview per template and pixel-diffs against the committed
 * baseline in tests/visual/. This is the test that actually catches layout
 * breakage — a CSS change that shifts the page fails here, not in a schema test.
 *
 *   node scripts/visual-check.mjs           compare against baselines
 *   node scripts/visual-check.mjs --update  rewrite baselines (after a wanted change)
 *
 * Dev server must be running. New templates get a baseline automatically.
 */
import puppeteer from 'puppeteer'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const BASELINE_DIR = 'tests/visual'
const THRESHOLD = 0.02 // fraction of pixels allowed to differ (antialiasing noise)
const update = process.argv.includes('--update')

const templateIds = readdirSync('lib/templates', { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join('lib/templates', e.name, 'template.json')))
  .map((e) => e.name)

mkdirSync(BASELINE_DIR, { recursive: true })
const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 900, height: 1300, deviceScaleFactor: 1 })

let failed = 0
for (const id of templateIds) {
  await page.goto(`http://localhost:3000/dev/preview?template=${id}`, { waitUntil: 'networkidle0' })
  await page.evaluateHandle('document.fonts.ready')
  const el = await page.$('.cs-page, [data-page]')
  if (!el) {
    console.error(`${id}: no page element`)
    failed++
    continue
  }

  const shot = PNG.sync.read(await el.screenshot())
  const baselinePath = join(BASELINE_DIR, `${id}.png`)

  if (update || !existsSync(baselinePath)) {
    writeFileSync(baselinePath, PNG.sync.write(shot))
    console.log(`${id}: baseline ${update ? 'updated' : 'created'}`)
    continue
  }

  const baseline = PNG.sync.read(readFileSync(baselinePath))
  if (baseline.width !== shot.width || baseline.height !== shot.height) {
    console.error(`${id}: size changed ${baseline.width}x${baseline.height} -> ${shot.width}x${shot.height}`)
    failed++
    continue
  }

  const diff = new PNG({ width: shot.width, height: shot.height })
  const mismatched = pixelmatch(baseline.data, shot.data, diff.data, shot.width, shot.height, {
    threshold: 0.1,
  })
  const fraction = mismatched / (shot.width * shot.height)

  if (fraction > THRESHOLD) {
    const diffPath = join(BASELINE_DIR, `${id}.diff.png`)
    writeFileSync(diffPath, PNG.sync.write(diff))
    console.error(`${id}: FAIL ${(fraction * 100).toFixed(2)}% pixels differ — see ${diffPath}`)
    failed++
  } else {
    console.log(`${id}: ok (${(fraction * 100).toFixed(3)}% diff)`)
  }
}

await browser.close()
process.exit(failed ? 1 : 0)
