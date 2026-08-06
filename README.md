# Coverpage Maker

Generate print-ready A4 coverpage PDFs for lab reports and assignments. Pick a
template, fill the form, watch the live preview, download the PDF.

**Design principle:** layouts are code, templates are data. A layout (React
component) is written once; every template on it is a `template.json` plus a
logo — no CSS, no code. See [docs/adding-a-template.md](docs/adding-a-template.md).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind (app shell only) · zod ·
Puppeteer + `@sparticuz/chromium` for the PDF route. Preview and PDF render the
same layout component, so they cannot drift apart.

## Develop

```bash
npm install
npm run dev          # app on :3000
npm test             # schema + layout tests
npm run test:e2e     # drives the real form, asserts %PDF bytes (dev server running)
npm run test:visual  # pixel-diff every template against tests/visual/ baselines
```

`/dev/preview?template=<id>` renders any template at true size with sample values.

## Structure

```
lib/layouts/      layout components (classic-seal, …)
lib/templates/    one folder per template: template.json (+ registry entry)
lib/pdf/          Chromium wrapper + HTML builder for the render route
components/       picker, dynamic form, scaled preview
app/api/render/   POST { templateId, values } → application/pdf
scripts/          PDF inspection, logo extraction, thumbnails, checks
docs/             design spec, plan, template authoring guide
```
