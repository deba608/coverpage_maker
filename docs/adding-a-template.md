# Adding a template

No CSS, no components — a template is data.

## Steps

1. Create the folder and JSON:

```
lib/templates/<your-id>/template.json
```

```json
{
  "id": "your-id",
  "name": "Your College — Lab Record",
  "description": "Short line shown under the name",
  "thumbnail": "/templates/your-id/thumb.png",
  "layout": "classic-seal",
  "brand": {
    "institution": ["YOUR COLLEGE NAME", "OPTIONAL SECOND LINE"],
    "address": "City, State",
    "logo": "/templates/your-id/seal.png",
    "logoWidthMm": 62,
    "font": "times",
    "border": "double"
  },
  "fields": [
    { "key": "labName",  "slot": "title",    "label": "Lab Name", "type": "text", "required": true, "maxLength": 30 },
    { "key": "semester", "slot": "subtitle", "label": "Semester", "type": "select", "required": true,
      "options": ["1st Semester", "2nd Semester", "3rd Semester", "4th Semester"] },
    { "key": "name",     "slot": "details",  "label": "Name",    "type": "text", "required": true, "maxLength": 32 },
    { "key": "rollNo",   "slot": "details",  "label": "Roll no", "type": "text", "required": true, "maxLength": 20 }
  ]
}
```

2. Drop the logo at `public/templates/<your-id>/seal.png` (transparent PNG,
   ≥800px wide prints sharp; `scripts/extract-pdf-logo.mjs` can pull one out of
   an existing PDF).

3. Register it — one line in `lib/templates/registry.ts`:

```ts
import yourId from './your-id/template.json'
// …
const templates: RegisteredTemplate[] = [
  { meta: sambalpurLab as TemplateMeta },
  { meta: yourId as TemplateMeta },
]
```

4. Generate the picker thumbnail (dev server running):

```bash
node scripts/make-thumb.mjs your-id
```

5. Check it: `npm test` validates the JSON (bad slot, duplicate key, missing
   options all fail with a message), `/dev/preview?template=your-id` shows the
   page, and `npm run test:visual` records its baseline.

## The knobs

| `brand.` | Values |
|---|---|
| `institution` | 1–3 lines, biggest first |
| `font` | `times` · `serif` · `sans` · `garamond` |
| `border` | `double` · `single` · `none` |
| `logoWidthMm` | number, default 55 |
| `accentColor` | `#rrggbb`, default black |

| `field.slot` | Renders as |
|---|---|
| `title` | big centred line (max one field) |
| `subtitle` | under the title (max one field) |
| `details` | a `Label : value` row in the box |

| `field.type` | Input |
|---|---|
| `text` | free text (set `maxLength`!) |
| `select` | dropdown (`options` required) |
| `number` / `date` | native inputs |

## When the layout doesn't fit

A genuinely different design means a new layout in `lib/layouts/`, not a bigger
config. `"layout": "custom"` plus a `CustomComponent` in the registry entry is
the escape hatch for a one-off.
