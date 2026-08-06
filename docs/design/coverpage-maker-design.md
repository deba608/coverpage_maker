# Coverpage Maker — Design Spec

**Date:** 2026-08-06 (amended: layouts + config)
**Status:** Draft

## Problem

Students hand-edit Word/Canva/PDF coverpage templates for every lab report. Each
template asks for a different set of details (name, roll no, section, branch, lab
name, semester, subject code, faculty, submission date…). Editing the source file
risks breaking the layout, and the three source formats have nothing in common.

## Goal

A web app where a user picks a template, fills a form that the template itself
defines, sees a live preview, and downloads a print-ready A4 PDF.

**And:** adding the second, fifth, and twentieth template must get progressively
cheaper — not cost the same as the first.

## Non-goals

- No template designer / drag-and-drop editor.
- No user accounts, saved history, or server-side persistence in v1.
- No DOCX output. PDF only.
- No bulk generation in v1 (see Future).

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Template format | **Layout component + JSON config** | See "Layouts vs templates" — the decision that makes template #10 cheap. |
| Render to PDF | Headless Chromium (Puppeteer) `page.pdf()` | Same engine that draws the preview, so preview and PDF are identical by construction. |
| Field definition | Per-template JSON schema | Solves "inputs vary per template" without code changes. |
| Framework | Next.js 16 (App Router), TypeScript | Server route for PDF, static hosting for the rest, deploys to Vercel unmodified. |
| Styling | Tailwind for the app shell; plain CSS for layouts | Layouts are design assets and must stay self-contained and readable. |
| Hosting | Vercel | `@sparticuz/chromium` runs headless Chrome in a Vercel function. LibreOffice would not. |
| Template authoring | JSON files committed to the repo | Adding a template = one JSON file + a logo. No admin UI to build. |
| Persistence | `localStorage` only | Remembers the user's last-entered values. No backend, no privacy surface. |

### Rejected alternatives

**DOCX + docxtemplater.** Reuses existing Word files as-is. Rejected because PDF
conversion needs LibreOffice, which cannot run on Vercel, and because live preview
is effectively impossible.

**One React component per template.** The obvious approach, and what the first
version of this spec said. Rejected because it makes every template cost the same
— a per-template CSS rewrite forever. See below.

**Server-side image render (Satori / node-canvas).** Lighter than Chromium, but
introduces a second layout engine that disagrees with the browser preview. The
thing that makes this app good is that preview === output.

---

## Layouts vs templates

**The observation:** most college coverpages are the same page with different
words. The skeleton

```
outer border → institution name → address → seal
→ document title + semester → details box of "label : value" rows
```

covers the overwhelming majority of them. What actually differs between colleges
is the institution name, the logo, the typeface, and the border treatment — not
the structure.

**So the unit of reuse is a layout, and a template is data.**

- A **layout** is a React component: the structure, written once, in code.
- A **template** is a JSON file: which layout, what branding, which fields.

```
lib/layouts/classic-seal/       ← code, written once, reused by many templates
  ├── ClassicSeal.tsx
  └── classic-seal.css

lib/templates/sambalpur-lab/    ← data, no code at all
  ├── template.json
  └── seal.png
```

### Cost curve

| Templates | What it takes |
|---|---|
| 1st | Build the `classic-seal` layout + its config. The expensive one. |
| 2nd–Nth on an existing layout | **One JSON file + a logo.** No code, no AI. The user can do it. |
| A genuinely novel design | A new layout component. Expected total: 3–4 layouts ever. |

Roughly four layouts should cover everything: `classic-seal` (centred, bordered,
seal — the Sambalpur page), `banner-header` (coloured header band), `minimal-line`
(rules instead of boxes), `boxed-grid` (two-column detail table).

### BrandConfig

The knobs a layout exposes to its templates. Deliberately small — a layout is
allowed to be opinionated. If a template needs a knob that isn't here, that's
evidence it wants a different layout, not a bigger config.

```ts
interface BrandConfig {
  institution: string[]          // 1–3 heading lines, rendered largest-first
  address?: string
  logo?: string                  // /templates/<id>/seal.png
  logoWidthMm?: number           // default 55
  font: 'serif' | 'sans' | 'times' | 'garamond'
  border: 'double' | 'single' | 'none'
  accentColor?: string           // default #000
}
```

### Slots

A layout declares named slots; each field names the slot it renders into. This is
what lets one layout serve templates with different field counts.

- `title` — the big centred line (e.g. "CN LAB")
- `subtitle` — under the title (e.g. "4th Semester")
- `details` — the boxed `label : value` rows, one per field assigned here

A `details` field renders as `Label : value` using the field's own `label`, so the
form and the page can never disagree about wording. Fields render in declaration
order within their slot.

### Escape hatch

A template may set `"layout": "custom"` and ship its own `Template.tsx`. The
registry supports it; nothing else changes. This exists so one weird design can
never block the project — but reaching for it twice for similar pages means a new
shared layout is the right answer instead.

---

## Architecture

```
Browser                                    Server (Vercel function)
───────────────────────────────────────    ─────────────────────────
TemplatePicker
      │ selects templateId
      ▼
getTemplate(id) ────────────────────────►  template.json  (validated in CI)
      │  { layout, brand, fields }
      ▼
DynamicForm  ── renders one input per field
      │ values: Record<string, string>
      ├────────────────────────────────►  localStorage (autosave)
      ▼
Preview  ── <Layout brand fields values /> scaled to fit
      │
      │ Download
      ▼
POST /api/render { templateId, values }
                                    ──►   validate values against the schema
                                          renderToStaticMarkup(<Layout … />)
                                          puppeteer → setContent → page.pdf
                                    ◄──   application/pdf
```

### Key property

The preview and the PDF render **the same layout component with the same props**.
The preview mounts it in the DOM; the PDF path renders it to static HTML and hands
that to Chromium. There is no second implementation of the layout to keep in sync.

## Components

### 1. Types — `lib/templates/types.ts`

`FieldDef`, `BrandConfig`, `TemplateMeta`, `LayoutProps`. The whole contract.

### 2. Schema — `lib/templates/schema.ts`

Zod mirror of the types, plus `valuesSchemaFor(fields)` which builds a per-template
validator for submitted values. Two jobs: failing CI on a malformed
`template.json`, and never trusting the client in the render route.

### 3. Layout registry — `lib/layouts/registry.ts`

Maps `LayoutId` → component. A layout component's contract:

```tsx
function ClassicSeal({ brand, fields, values }: LayoutProps): ReactElement
```

Pure function of props. No hooks, no browser APIs (it renders on the server), no
network requests — fonts and logos come from `/public`. Renders exactly one
`210mm × 297mm` root.

### 4. Template registry — `lib/templates/registry.ts`

Static imports of every `template.json`. Exports `listTemplates()` and
`getTemplate(id)`, the latter resolving the layout component too. Static because a
runtime filesystem scan does not work on a serverless host.

### 5. DynamicForm — `components/DynamicForm.tsx`

Maps `FieldDef[]` → inputs. Knows nothing about layouts or any specific template.

### 6. Preview — `components/Preview.tsx`

Renders the layout inside a container scaled with `transform: scale(k)` where
`k = containerWidth / 794px` (A4 at 96 dpi). Scaling the whole page keeps the
preview geometrically identical to the PDF at any viewport size.

### 7. Render route — `app/api/render/route.ts`

`POST { templateId, values }` → PDF. Look up template → validate values (400 on
unknown id or missing required field) → `renderToStaticMarkup` → launch Chromium →
`setContent` with layout CSS inlined → `page.pdf({ format: 'A4', printBackground:
true })` → stream back as an attachment. Browser instance cached per warm lambda.

## Data flow / state

One `values: Record<string, string>` object lives in the page component. The form
writes it, the preview reads it, the download posts it. Switching templates keeps
values whose keys the new template also defines — so name/roll/branch carry over
between templates for free.

## Adding a template

The common case, and the point of the whole design:

```
lib/templates/vssut-dbms/
  ├── template.json
  └── seal.png
```

```json
{
  "id": "vssut-dbms",
  "name": "VSSUT — DBMS Lab",
  "description": "Bordered coverpage with university seal",
  "thumbnail": "/templates/vssut-dbms/thumb.png",
  "layout": "classic-seal",
  "brand": {
    "institution": ["VEER SURENDRA SAI UNIVERSITY OF TECHNOLOGY"],
    "address": "Burla, Sambalpur",
    "logo": "/templates/vssut-dbms/seal.png",
    "font": "times",
    "border": "double"
  },
  "fields": [
    { "key": "labName",  "slot": "title",    "label": "Lab Name", "type": "text", "required": true, "maxLength": 30 },
    { "key": "semester", "slot": "subtitle", "label": "Semester", "type": "select", "required": true,
      "options": ["1st","2nd","3rd","4th","5th","6th","7th","8th"] },
    { "key": "name",     "slot": "details",  "label": "Name",     "type": "text", "required": true, "maxLength": 40 },
    { "key": "rollNo",   "slot": "details",  "label": "Roll no",  "type": "text", "required": true, "maxLength": 20 },
    { "key": "section",  "slot": "details",  "label": "Section",  "type": "select", "options": ["A","B","C","D"] },
    { "key": "branch",   "slot": "details",  "label": "Branch",   "type": "select",
      "options": ["CSE","IT","ECE","EE","ME","CE"] }
  ]
}
```

Plus one line in `registry.ts`. No CSS, no component, no build knowledge.

## Error handling

| Failure | Handling |
|---|---|
| Unknown `templateId` | 400 from API; the picker cannot produce one |
| Unknown `layout` id | Caught in CI by the schema test, not at runtime |
| Missing required field | Download disabled client-side; API returns 400 with the field list as defence in depth |
| Chromium launch fails / times out | 500 with a plain message; UI offers `window.print()` as fallback (the preview is already print-correct) |
| Oversized text overflows | `maxLength` per field, plus `overflow: hidden` on text boxes so a long value never breaks the page geometry |
| Missing font | Fonts self-hosted in `/public/fonts`, preloaded; no external fetch at render time |

## Testing

- **Schema validation** (vitest): every `template.json` parses; field keys unique; every `select` has `options`; every `layout` id resolves; every `slot` is one its layout declares. Runs over all templates automatically. **This is what makes JSON-only authoring safe** — a bad template fails CI instead of shipping a broken page.
- **Layout purity** (vitest + RTL): each layout renders to static markup with empty values and with full values without throwing.
- **API route** (vitest): valid payload → `%PDF` magic bytes; missing required field → 400; unknown id → 400.
- **Visual regression** (Playwright): screenshot the preview per template against a committed baseline. The test that actually catches layout breakage.

## Future (explicitly not v1)

- **PDF importer**: extract text items with positions via pdfjs, cluster into blocks, guess static-vs-field with the `label :` heuristic, emit a draft `template.json`. Worth building past ~10 templates; wasted effort before that.
- Bulk mode: upload a CSV of students → ZIP of PDFs.
- Saved profile so name/roll/branch pre-fill on first visit.
- DOCX output for people who must edit after generating.
