# Coverpage Maker — Implementation Plan

Spec: `docs/design/coverpage-maker-design.md` (amended for layouts + config)

Phases 1–4 give a working app; 5–7 harden it and ship it.

---

## Phase 0 — Scaffold ✅ done

Next.js 16 (App Router, TS, Tailwind, Turbopack), vitest + RTL + jsdom,
Playwright runner, `zod`, and both Puppeteer packages: `puppeteer` (bundled
Chrome) for local dev and tests, `puppeteer-core` + `@sparticuz/chromium` (a
Lambda-sized Chromium) for Vercel. One wrapper picks between them by `NODE_ENV`.

Scripts: `test`, `test:watch`, `test:e2e`, `typecheck`.

---

## Phase 1 — Contract ✅ partly done, needs amending

Done: `lib/templates/types.ts`, `lib/templates/schema.ts`, an empty
`lib/templates/registry.ts`, and a schema test that globs every
`lib/templates/*/template.json`.

**Amendment for layouts:**
- `FieldDef` gains `slot: 'title' | 'subtitle' | 'details'`
- `TemplateMeta` gains `layout: LayoutId` and `brand: BrandConfig`
- New `lib/layouts/registry.ts` mapping layout id → component + declared slots
- Schema test additionally asserts every `layout` id resolves and every `slot` is
  one that layout declares

Those two assertions are what make JSON-only template authoring safe: a typo in a
hand-written `template.json` fails CI instead of rendering a broken page.

**Done when:** `npm test` green, contract covers layout + brand + slots.

---

## Phase 2 — The `classic-seal` layout

The expensive phase, and the one that determines whether every later template is
cheap. Built from the Sambalpur reference PDF, but **written generically** — it
takes `brand` and `fields` as props and hardcodes nothing about Sambalpur.

`lib/layouts/classic-seal/ClassicSeal.tsx` + `classic-seal.css`.

CSS approach — this decides whether the whole thing looks right:

```css
.page {
  width: 210mm; height: 297mm;
  padding: 12mm;
  box-sizing: border-box;
  background: #fff;
  position: relative;
}
@page { size: A4; margin: 0; }
```

Use `mm` throughout, never `px`. Millimetres mean the preview, the PDF, and the
printed page are the same size, and nothing shifts at a different device pixel
ratio. The nested double border is two absolutely positioned `div`s at different
insets. The seal is sized in `mm` from `brand.logoWidthMm`.

The `brand.font` and `brand.border` values map to CSS custom properties set on the
root, so a template switches typeface or border treatment without touching CSS.

**Test as you go:** a vitest case rendering the layout with empty values and with
full values, plus a scratch page for eyeballing against the reference.

**Done when:** the layout renders the Sambalpur page correctly *and* renders
sensibly when handed a different institution, a longer name list, and no logo.

---

## Phase 3 — First template as pure JSON

`lib/templates/sambalpur-lab/template.json` + `seal.png`. Zero code beyond one
registry line.

Extract the seal from the source PDF at full resolution — a screenshot crop will
look soft in print. Target ≥1000px wide.

**This phase is the proof.** If it needs any CSS, Phase 2 leaked and gets fixed
before moving on.

**Done when:** `getTemplate('sambalpur-lab')` renders the reference page.

---

## Phase 4 — Form + preview

- `components/TemplatePicker.tsx` — thumbnail grid
- `components/DynamicForm.tsx` — `FieldDef[]` → inputs, controlled by one `values` object
- `components/Preview.tsx` — scaled layout, `transform: scale(k)`, `k = width / 794`
- `app/page.tsx` — owns `values`, wires the three together
- `lib/useLocalStorage.ts` — autosave `values` under `coverpage:values`

Layout: picker across the top, form left, preview right; stacked on mobile.
Preview updates on every keystroke — plain React state, no debounce needed.

**Done when:** typing a name changes the preview live, and a reload restores it.

---

## Phase 5 — PDF download

`lib/pdf/browser.ts`:

```ts
export async function getBrowser() {
  if (process.env.NODE_ENV === 'development') {
    const puppeteer = await import('puppeteer')
    return puppeteer.launch({ headless: true })
  }
  const chromium = (await import('@sparticuz/chromium')).default
  const puppeteer = await import('puppeteer-core')
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}
```

`app/api/render/route.ts` with `export const runtime = 'nodejs'` and
`maxDuration = 30`. Look up template → zod-validate `values` → `renderToStaticMarkup`
→ wrap in a full HTML document with the layout CSS inlined in a `<style>` tag →
`setContent(html, { waitUntil: 'networkidle0' })` → `page.pdf({ format: 'A4',
printBackground: true })`.

`printBackground: true` is not optional — without it every border, shaded box, and
background colour silently vanishes from the PDF.

Filename: `${values.name}-${values.labName}.pdf`, sanitised.

Next.js 16 has breaking API changes vs. older versions — read
`node_modules/next/dist/docs/` before writing the route handler.

**Done when:** the downloaded PDF opens at exactly A4 and matches the preview.

---

## Phase 6 — Templates 2 and 3, JSON only

Add two more colleges as `template.json` + logo. **No code changes allowed.** If
either needs code, the layout abstraction is wrong and gets fixed here — this is
cheap now and expensive at template ten.

Watch for fields the first template didn't need (subject code, faculty name,
submission date, group members). Those go in the schema, not in code. A field that
genuinely won't fit an existing slot is a signal for either a new slot or a second
layout — decide deliberately, don't reach for `"layout": "custom"` by reflex.

**Done when:** three templates, one layout, zero changes to `DynamicForm`, the
layout, or the API route.

---

## Phase 7 — Hardening and deploy

- Playwright visual regression: one baseline screenshot per template
- `maxLength` on every text field; `overflow: hidden` on text boxes
- `window.print()` fallback if `/api/render` fails, with a print stylesheet hiding the app chrome
- Empty-state preview: placeholder text (`[Name]`) rather than blank gaps
- Loading state on the download button; Chromium cold start is ~2s
- A short `docs/adding-a-template.md` so the JSON path is usable without asking

```bash
npx vercel --prod
```

Verify on the deployed URL, not just locally — the Chromium path only differs in
production, so a cold-start failure will not reproduce on your machine. Download
one PDF from prod and print it to confirm the margins.

---

## Risks

| Risk | Mitigation |
|---|---|
| The `classic-seal` abstraction turns out too rigid | Phase 6 is the deliberate early test, with `"layout": "custom"` as the escape hatch so one odd design never blocks the project |
| Chromium exceeds Vercel's function size limit | `@sparticuz/chromium` is built for this; if it still fails, move `/api/render` to Railway/Fly and keep the frontend on Vercel |
| Rebuilding the design in CSS takes longer than expected | Phase 2 is the honest estimate. Phases 3 and 6 are much faster — that is the point of the split |
| Fonts render differently in the PDF | Self-host WOFF2 in `/public/fonts`, no external font fetches |
| Long names break the layout | `maxLength` + `overflow: hidden`, caught by visual regression |

## Effort

Phase 2 dominates. Phase 3 is a JSON file. Phase 6 should feel almost free — if it
doesn't, that is the signal to fix the abstraction rather than push through.
