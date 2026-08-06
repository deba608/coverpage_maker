# Coverpage Maker — Design Spec

**Date:** 2026-08-06
**Status:** Draft, awaiting review

## Problem

Students hand-edit Word/Canva/PDF coverpage templates for every lab report. Each
template asks for a different set of details (name, roll no, section, branch, lab
name, semester, subject code, faculty, submission date…). Editing the source file
risks breaking the layout, and the three source formats have nothing in common.

## Goal

A web app where a user picks a template, fills a form that the template itself
defines, sees a live preview, and downloads a print-ready A4 PDF.

## Non-goals

- No template designer / drag-and-drop editor.
- No user accounts, saved history, or server-side persistence in v1.
- No DOCX output. PDF only.
- No bulk generation in v1 (see Future).

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Template format | HTML + CSS, A4-sized | One engine, exact pixel control, and the preview is the artifact — no format conversion round-trip. |
| Render to PDF | Headless Chromium (Puppeteer) `page.pdf()` | Same engine that draws the preview, so preview and PDF are identical by construction. |
| Field definition | Per-template JSON schema | Solves "inputs vary per template" without code changes. |
| Framework | Next.js (App Router), TypeScript | Server route for PDF, static hosting for the rest, deploys to Vercel unmodified. |
| Styling | Tailwind for the app shell; plain CSS for template files | Templates must stay self-contained and readable — they are the design assets. |
| Hosting | Vercel | `@sparticuz/chromium` runs headless Chrome in a Vercel function. LibreOffice would not. |
| Template authoring | Files committed to the repo | No admin UI to build; adding a template = 2 files + redeploy. |
| Persistence | `localStorage` only | Remembers the user's last-entered values so repeat use is one click. No backend, no privacy surface. |

### Rejected alternatives

**DOCX + docxtemplater.** Reuses existing Word files as-is, which is genuinely
appealing. Rejected because PDF conversion needs LibreOffice, which cannot run on
Vercel — it would force a container host — and because live preview is effectively
impossible. The one-time cost of rebuilding each template in CSS buys a much
better product.

**Server-side image render (node-canvas / Satori).** Lighter than Chromium, but
gives vector-less output and a second layout engine that disagrees with the
browser preview. The thing that makes this app good is that preview === output.

## Architecture

```
Browser                                    Server (Vercel function)
───────────────────────────────────────    ─────────────────────────
TemplatePicker
      │ selects templateId
      ▼
useTemplate(templateId)  ──── loads ────►  /templates/<id>/template.json
      │                                     (static, from registry)
      ▼
DynamicForm  ── renders one input per field in schema
      │ values: Record<string, string>
      ├────────────────────────────────►  localStorage (autosave)
      ▼
Preview  ── renders template component with values, scaled to fit
      │
      │ user clicks Download
      ▼
POST /api/render { templateId, values }
                                    ──►   validate against schema (zod)
                                          renderToStaticMarkup(<Template/>)
                                          puppeteer → page.setContent → page.pdf
                                    ◄──   application/pdf
```

### Key property

The preview and the PDF render **the same React template component**. The preview
mounts it in the DOM; the PDF path renders it to static HTML and hands that to
Chromium. There is no second implementation of the layout to keep in sync.

## Components

Each unit below is independently testable and has one job.

### 1. Template registry — `lib/templates/registry.ts`

```ts
export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'select' | 'number' | 'date'
  required?: boolean
  options?: string[]       // select only
  placeholder?: string
  maxLength?: number
}

export interface TemplateMeta {
  id: string
  name: string
  description: string
  thumbnail: string        // /templates/<id>/thumb.png
  fields: FieldDef[]
}
```

A single `registry.ts` imports every `template.json` and every template component,
exporting `getTemplate(id)` and `listTemplates()`. Static imports keep it
type-safe and let the bundler tree-shake; a dynamic filesystem scan would not work
on Vercel's serverless filesystem.

**Depends on:** nothing. **Used by:** picker, form, preview, render route.

### 2. Template component — `lib/templates/<id>/Template.tsx`

```tsx
export default function Template({ values }: { values: Record<string, string> }) {
  return <div className="page">{/* absolutely-positioned A4 layout */}</div>
}
```

Contract: pure function of `values`, renders exactly one `210mm × 297mm` root, no
hooks, no browser APIs (it must render on the server), no external network
requests (fonts and logos are inlined or served from `/public`). Each template
ships a co-located `template.css`.

**Depends on:** its own CSS + assets. **Used by:** preview and render route.

### 3. DynamicForm — `components/DynamicForm.tsx`

Maps `FieldDef[]` → inputs. Knows nothing about any specific template. Validation
mirrors the schema: required fields block download, `maxLength` truncates.

### 4. Preview — `components/Preview.tsx`

Renders the template component inside a container scaled with
`transform: scale(k)` where `k = containerWidth / 794px` (A4 at 96 dpi). Scaling
the whole page keeps the preview geometrically identical to the PDF at any
viewport size.

### 5. Render route — `app/api/render/route.ts`

`POST { templateId, values }` → PDF bytes. Steps: look up template → validate
values against its schema (reject unknown template id, reject missing required
fields with 400) → `renderToStaticMarkup` → launch Chromium → `setContent` with
inlined CSS → `page.pdf({ format: 'A4', printBackground: true })` → stream back
with `Content-Disposition: attachment`.

Browser instance is cached per warm lambda; a cold start pays ~2s.

## Data flow / state

One `values: Record<string, string>` object lives in the page component. The form
writes it, the preview reads it, the download button posts it. Switching templates
keeps values whose keys the new template also defines — so name/roll/branch carry
over between templates for free.

## Adding a template (the workflow this whole design exists to enable)

```
lib/templates/sambalpur-lab/
  ├── template.json     ← field definitions
  ├── Template.tsx      ← the layout
  ├── template.css
  └── assets/logo.png
```
Then add one line to `registry.ts`. No other code changes.

Example `template.json`:

```json
{
  "id": "sambalpur-lab",
  "name": "Sambalpur University — Lab Report",
  "description": "IIT Burla lab coverpage with university seal",
  "thumbnail": "/templates/sambalpur-lab/thumb.png",
  "fields": [
    { "key": "labName",  "label": "Lab Name", "type": "text", "required": true, "placeholder": "CN LAB" },
    { "key": "semester", "label": "Semester", "type": "select", "required": true,
      "options": ["1st","2nd","3rd","4th","5th","6th","7th","8th"] },
    { "key": "name",     "label": "Name",     "type": "text", "required": true },
    { "key": "rollNo",   "label": "Roll No",  "type": "text", "required": true },
    { "key": "section",  "label": "Section",  "type": "select", "options": ["A","B","C","D"] },
    { "key": "branch",   "label": "Branch",   "type": "select",
      "options": ["CSE","IT","ECE","EE","ME","CE"] }
  ]
}
```

## Error handling

| Failure | Handling |
|---|---|
| Unknown `templateId` | 400 from API; picker can't produce one |
| Missing required field | Download button disabled client-side; API returns 400 with field list as defence in depth |
| Chromium launch fails / times out | 500 with a plain message; UI offers browser-native `window.print()` as fallback (the preview is already print-correct) |
| Oversized text overflows layout | `maxLength` per field, plus CSS `overflow: hidden` on text boxes so a long value never breaks the page geometry |
| Missing font | Fonts self-hosted in `/public/fonts` and preloaded; no Google Fonts fetch at render time |

## Testing

- **Schema validation** (vitest): every `template.json` parses against the `FieldDef` zod schema; every `field.key` is unique within a template; every `select` has `options`. Runs over all templates automatically, so a malformed new template fails CI.
- **Template purity** (vitest + RTL): each template renders to static markup with empty values and with full values without throwing.
- **API route** (vitest): valid payload → `%PDF` magic bytes; missing required field → 400; unknown id → 400.
- **Visual regression** (Playwright): screenshot the preview per template, compare against a committed baseline. This is the test that actually catches layout breakage.

## Future (explicitly not v1)

- Bulk mode: upload a CSV of students → ZIP of PDFs.
- Saved profile so name/roll/branch are pre-filled on first visit.
- Admin upload UI for templates.
- DOCX output for people who must edit after generating.
