# Coverpage Maker — Implementation Plan

Spec: `docs/superpowers/specs/2026-08-06-coverpage-maker-design.md`

Seven phases. Each ends in something you can run and see. Phases 1–4 give a
working app; 5–7 harden it and ship it.

---

## Phase 0 — Scaffold

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*"
```

```bash
npm i zod puppeteer-core @sparticuz/chromium
npm i -D puppeteer vitest @vitejs/plugin-react @testing-library/react jsdom @playwright/test
```

Two Puppeteer packages on purpose: `puppeteer` (full, with a bundled Chrome) for
local dev and tests; `puppeteer-core` + `@sparticuz/chromium` (a Lambda-sized
Chromium binary) for Vercel. One wrapper picks between them by `NODE_ENV`.

**Done when:** `npm run dev` serves the default page.

---

## Phase 1 — Template contract

Files:
- `lib/templates/types.ts` — `FieldDef`, `TemplateMeta` interfaces
- `lib/templates/schema.ts` — the zod schemas that mirror them
- `lib/templates/registry.ts` — `listTemplates()`, `getTemplate(id)`

Write the schema test first: it globs every `template.json` and asserts each one
parses, has unique field keys, and gives `options` for every `select`. It passes
vacuously with zero templates and starts guarding the moment you add one.

**Done when:** `npm test` green with the (empty) registry.

---

## Phase 2 — First template

Rebuild the Sambalpur coverpage from your screenshot as
`lib/templates/sambalpur-lab/`.

CSS approach — this is the part that decides whether the whole thing looks right:

```css
.page {
  width: 210mm; height: 297mm;
  padding: 12mm;
  box-sizing: border-box;
  font-family: 'Times New Roman', serif;
  background: #fff;
  position: relative;
}
@page { size: A4; margin: 0; }
```

Use `mm` throughout the template, never `px`. Millimetres mean the preview, the
PDF, and the printed page are the same size, and nothing shifts at a different
device pixel ratio. The nested double border in your reference is two absolutely
positioned `div`s with `border: 2px solid #000` at different insets. The seal is a
PNG in `assets/`, sized in `mm`.

Extract the university seal from the sample PDF, or scan/crop it, and drop it in
`assets/logo.png` at 300+ dpi so it stays crisp when printed.

**Done when:** rendering `<Template values={sample}/>` in a scratch page visually
matches the reference image.

---

## Phase 3 — Form + preview

- `components/TemplatePicker.tsx` — thumbnail grid
- `components/DynamicForm.tsx` — `FieldDef[]` → inputs, controlled by one `values` object
- `components/Preview.tsx` — scaled template, `transform: scale(k)`, `k = width / 794`
- `app/page.tsx` — owns `values`, wires the three together
- `lib/useLocalStorage.ts` — autosave `values` under `coverpage:values`

Layout: picker across the top, form on the left, preview on the right, stacked on
mobile. Preview updates on every keystroke — it's just React state, no debounce
needed for text.

**Done when:** typing a name changes the preview live, and a reload restores what
you typed.

---

## Phase 4 — PDF download

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

`app/api/render/route.ts`:

```ts
export const runtime = 'nodejs'
export const maxDuration = 30
```

Look up template → zod-validate `values` → `renderToStaticMarkup` → wrap in a full
HTML document with the template CSS inlined in a `<style>` tag → `setContent(html,
{ waitUntil: 'networkidle0' })` → `page.pdf({ format: 'A4', printBackground: true })`.

`printBackground: true` is not optional — without it every border, shaded box, and
background colour silently vanishes from the PDF.

Filename: `${values.name}-${values.labName}.pdf`, sanitised.

**Done when:** the downloaded PDF opens at exactly A4 and matches the preview.

---

## Phase 5 — Second and third templates

Add two more of your existing templates. This is the real test of the design: if
adding one costs more than a JSON file, a component, and a registry line, the
abstraction leaked and needs fixing now rather than at template ten.

Watch for fields the first template didn't need (subject code, faculty name,
submission date, group members) — those go in the schema, not in code.

**Done when:** three templates, no changes to `DynamicForm` or the API route.

---

## Phase 6 — Hardening

- Playwright visual regression: one baseline screenshot per template.
- Overflow: `maxLength` on every text field; `overflow: hidden` on text boxes.
- `window.print()` fallback path if `/api/render` fails, with a print stylesheet that hides the app chrome.
- Empty-state preview: show placeholder text (`[Name]`) rather than blank gaps.
- Loading state on the download button; Chromium cold start is ~2s.

---

## Phase 7 — Deploy

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
| Chromium exceeds Vercel's function size limit | `@sparticuz/chromium` is built for this; if it still fails, move `/api/render` to Railway/Fly and keep the frontend on Vercel |
| Rebuilding Canva designs in CSS takes longer than expected | Phase 2 is the honest estimate for template #1. Templates 2 and 3 are much faster — you'll have reusable border/heading/detail-box CSS by then |
| Fonts render differently in the PDF | Self-host WOFF2 in `/public/fonts`, no external font fetches |
| Long names break the layout | `maxLength` + `overflow: hidden`, caught by visual regression |

## Effort

Phases 0–4 (working app, one template): the bulk of the work, most of it in
Phase 2's CSS. Phases 5–7: substantially faster, mostly mechanical.
