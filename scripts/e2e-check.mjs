/**
 * Dev smoke test: drives the real app — fill form, screenshot, hit /api/render —
 * and checks the PDF magic bytes. node scripts/e2e-check.mjs (dev server running)
 */
import puppeteer from 'puppeteer'
import { writeFileSync } from 'node:fs'

const base = 'http://localhost:3000'
const shotPath = process.argv[2] ?? 'app-shot.png'

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 1000 })
await page.goto(base, { waitUntil: 'networkidle0' })

// Fill the form.
await page.type('#field-labName', 'CN LAB')
await page.select('#field-semester', '4th Semester')
await page.type('#field-name', 'DEBASHISH PRADHAN')
await page.type('#field-rollNo', '24BTCSE04')
await page.select('#field-section', 'A')
await page.select('#field-branch', 'CSE')
await new Promise((r) => setTimeout(r, 500))

await page.screenshot({ path: shotPath })
console.log(`screenshot: ${shotPath}`)

// Button enabled?
const disabled = await page.$eval('button[type="button"]:not([aria-pressed])', (b) => b.disabled)
console.log(`download button disabled: ${disabled}`)

// Hit the API directly with the same values.
const res = await page.evaluate(async () => {
  const r = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: 'sambalpur-lab',
      values: {
        labName: 'CN LAB',
        semester: '4th Semester',
        name: 'DEBASHISH PRADHAN',
        rollNo: '24BTCSE04',
        section: 'A',
        branch: 'CSE',
      },
    }),
  })
  const buf = new Uint8Array(await r.arrayBuffer())
  return { status: r.status, type: r.headers.get('content-type'), bytes: Array.from(buf.slice(0, 5)), size: buf.length, full: Array.from(buf) }
})

console.log(`api: ${res.status} ${res.type} ${res.size} bytes`)
const magic = String.fromCharCode(...res.bytes)
console.log(`magic: ${magic} ${magic.startsWith('%PDF') ? 'OK' : 'FAIL'}`)
if (magic.startsWith('%PDF')) {
  writeFileSync(shotPath.replace(/\.png$/, '.pdf'), Buffer.from(res.full))
  console.log(`pdf saved: ${shotPath.replace(/\.png$/, '.pdf')}`)
}

// Missing required field → 400?
const bad = await page.evaluate(async () => {
  const r = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId: 'sambalpur-lab', values: { labName: '' } }),
  })
  return r.status
})
console.log(`missing-required status: ${bad} ${bad === 400 ? 'OK' : 'FAIL'}`)

// Inline meta (the path imported templates use) → also a PDF.
const inline = await page.evaluate(async () => {
  const metaJson = {
    id: 'custom-test',
    name: 'Custom Test',
    description: 'inline meta e2e',
    thumbnail: '/window.svg',
    layout: 'classic-seal',
    brand: { institution: ['TEST COLLEGE'], font: 'times', border: 'double' },
    fields: [
      { key: 'name', label: 'Name', slot: 'details', type: 'text', required: true, maxLength: 40 },
    ],
  }
  const r = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meta: metaJson, values: { name: 'INLINE META' } }),
  })
  const buf = new Uint8Array(await r.arrayBuffer())
  return { status: r.status, magic: String.fromCharCode(...buf.slice(0, 5)) }
})
console.log(
  `inline-meta: ${inline.status} ${inline.magic} ${
    inline.status === 200 && inline.magic.startsWith('%PDF') ? 'OK' : 'FAIL'
  }`,
)

const unknown = await page.evaluate(async () => {
  const r = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId: 'nope', values: {} }),
  })
  return r.status
})
console.log(`unknown-template status: ${unknown} ${unknown === 400 ? 'OK' : 'FAIL'}`)

await browser.close()
