# Template pipeline — from a source PDF to a live template

What happens, step by step, when a new coverpage PDF arrives. This is the exact
flow used for `Coverpage_CN.pdf` (the Sambalpur template); every future
template follows it.

**Scope note:** the app itself has no upload — end users only fill forms. This
document is the *authoring* pipeline: how a source file becomes a registered
template in the repo.

---

## The flow at a glance

```
source PDF ──► 1 inspect (geometry) ──► 2 classify static/field ──► 3 extract seal
                                              │
              4 layout exists? ──yes──► 5 template.json ──► 6 registry + npm test
                    │ no                                          │
              build layout once                    7 thumbnail + visual baseline
              (from step 1's mm)                                  │
                                                          8 push ──► live
```

---

## Step 1 — Measure: `scripts/inspect-pdf.mjs`

```bash
node scripts/inspect-pdf.mjs path/to/source.pdf
```

pdfjs opens the PDF and walks every text item. For each one it converts PDF
points to millimetres and flips the origin (PDF measures from the bottom-left
corner, CSS from the top-left), then prints position, size, font, and text:

```
  y(mm)   x(mm)  size  text
   43.2   59.6   20.0  SAMBALPUR UNIVERSITY
  168.7   89.2   24.0  CN LAB
  221.0   33.9   26.7  Name
  221.0   72.2   26.7  DEBASHISH PRADHAN
```

The output is the page's exact geometry. Layout CSS is then transcription of
these numbers, not eyeballing a screenshot. It also lists embedded images, so
you know a seal is in there before trying to extract it.

## Step 2 — Classify: static vs field

The one step that needs judgment. Every string from step 1 gets a verdict,
using these signals:

| Signal | Verdict |
|---|---|
| Left of a `:` | static label (the layout prints it) |
| Right of a `:` | **field** (the user types it) |
| College name / address / motto | static → `brand` |
| Looks personal (name, roll pattern like `24BTCSE04`) | **field** |
| From a small known set (A/B/C, CSE/EE, 1st–8th) | **field**, type `select` with options |

The result is a table — every string marked static or field — that the template
owner approves before anything is written. Ambiguous cases (is faculty name
fixed? auto-fill the date?) are asked, not guessed.

## Step 3 — Extract assets: `scripts/extract-pdf-logo.mjs`

```bash
node scripts/extract-pdf-logo.mjs source.pdf public/templates/<id>/seal.png
```

A logo lives in a PDF as **two** streams: the colour bitmap and a greyscale
`/SMask` holding its transparency. Extracted naively, black line-art is just a
black rectangle. The script inflates both streams and re-pairs them
pixel-by-pixel into a transparent RGBA PNG at the source's full resolution —
sharper than any screenshot crop.

It warns if the result is under ~800px wide (soft in print). Swapping in a
better scan later touches nothing else.

## Step 4 — Pick or build a layout

Compare the page's *structure* (not its words) against `lib/layouts/`:

- **Structure matches an existing layout** (`classic-seal`: centred institution
  block → seal → title → boxed label:value rows) → nothing to build, go to
  step 5. This is the common case and the point of the whole design.
- **Genuinely novel structure** → write a new layout component once, using
  step 1's millimetre measurements. All sizes in `mm`/`pt`, never `px`, so the
  preview, the PDF, and the printed page are the same size. Expected total
  across all colleges: 3–4 layouts ever.

## Step 5 — Write `template.json`

Step 2's table, transcribed. Statics go in `brand`, fields go in `fields[]`:

```json
{
  "id": "sambalpur-lab",
  "layout": "classic-seal",
  "brand": {
    "institution": ["SAMBALPUR UNIVERSITY", "INSTITUTE OF INFORMATION TECHNOLOGY"],
    "address": "Jyoti Vihar, Burla",
    "logo": "/templates/sambalpur-lab/seal.png",
    "font": "times",
    "border": "double"
  },
  "fields": [
    { "key": "labName",  "slot": "title",    "label": "Lab Name", "type": "text",   "required": true },
    { "key": "semester", "slot": "subtitle", "label": "Semester", "type": "select", "options": ["1st Semester", "…"] },
    { "key": "name",     "slot": "details",  "label": "Name",     "type": "text",   "required": true },
    { "key": "rollNo",   "slot": "details",  "label": "Roll no",  "type": "text",   "required": true }
  ]
}
```

How the app "knows which fields to change": **the file declares it.** `brand`
never changes per student; `fields[]` is exactly the list of things the form
asks for. One field entry drives three things at once:

```
              ┌─ FORM:  a text input labelled "Roll no *"
rollNo entry ─┼─ PAGE:  the details box prints "Roll no : <typed value>"
              └─ API:   the server rejects a download while it is empty
```

Same object read three times, so the form and the page can never disagree.
`slot` says where on the page the value lands (`title` / `subtitle` /
`details`).

## Step 6 — Register and validate

One line in `lib/templates/registry.ts`:

```ts
import sambalpurLab from './sambalpur-lab/template.json'
// …
{ meta: sambalpurLab as TemplateMeta },
```

Then:

```bash
npm test
```

The schema test validates every `template.json` in the repo: kebab-case id
matching its folder, unique field keys, `options` present on every `select`,
the layout id resolving, every slot being one the layout declares. A typo fails
here with a message — never in production as a broken page.

## Step 7 — Thumbnail and visual baseline

```bash
node scripts/make-thumb.mjs <id>     # picker thumbnail (dev server running)
npm run test:visual                  # records tests/visual/<id>.png baseline
```

From now on any CSS change that shifts this template's pixels fails the visual
diff (`--update` re-blesses after intentional changes).

## Step 8 — Push → live

Commit, push, Vercel builds, the template appears in the picker.

---

## Manual today vs automated later

| Step | Today | At ~10+ templates ("the importer") |
|---|---|---|
| 1 measure, 3 extract | scripted ✅ | same scripts, same code |
| 2 classify | human approves a table | auto-guessed via the `label :` heuristic, corrected in a UI |
| 5 write JSON | transcribed by hand | emitted as a draft by the importer |
| 4 layouts | human, rare | human, rare |

Steps 1 and 3 were deliberately built as reusable scripts — they are the
importer's front half, already written.
