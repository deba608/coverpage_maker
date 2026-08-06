# Feature Plan — Bulk v2 + Quality-of-life

Date: 2026-08-07. Status of each item is updated as it lands.

## 1. Bulk: form values as constants (the core fix) — DONE

Problem: a class list CSV rarely repeats Lab Name / Semester on every row —
they're the same for everyone. Today a missing required column blocks the
whole upload.

Design:

- A CSV column, when present, always wins for that field.
- A field with **no column** falls back to the value currently typed in the
  form — the form becomes the place you set the "constants".
- The panel says exactly what it's doing:
  - "Lab Name, Semester: taken from the form for all rows" (info, not error)
  - Error only when a required field has no column **and** no form value.
- No new settings UI. The form is already the constants editor; bulk just
  reads it. One mental model: *form = defaults, CSV = per-student overrides.*

## 2. Paste from Excel/Sheets — DONE

A textarea next to the CSV upload. Pasting cells from Excel/Sheets produces
tab-separated text; the parser treats `\t` as the delimiter when the first
line contains tabs, else commas. Same matching/validation pipeline after that.

## 3. One merged PDF (staple order) — DONE

Choice at generate time: ZIP of per-student PDFs (as now) **or** one PDF with
one page per student, in row order — what a class rep actually prints.

Server: `/api/render` accepts `rows: values[]` (2–60) alongside the existing
single `values`. `buildHtml` already renders one `.cs-page`; multi-row wraps
N pages in one document — Chromium paginates naturally since each page is
exactly 297mm. One browser launch, one `page.pdf()` call, well inside the
30s budget (~60 pages ≈ a few seconds; the per-PDF launch overhead is what
made N separate calls slow, not page count).

## 4. Long-value auto-shrink — DONE

A 30-character name overflows the details box. Pure-SSR layout can't measure
text, so a character-count heuristic steps the font down: value length ≤ 24
→ 20pt (as now), ≤ 34 → 17pt, longer → 14pt. Applied per details row and to
title/subtitle. Thresholds tuned against Tinos at the box's 95mm width.

## 5. Backup: export / import everything — DONE

Two buttons in a small "Backup" row under the template shelf:
- Export → downloads `coverpage-backup.json` with custom templates +
  per-template overrides + form values.
- Import → reads that file, validates each template against the schema,
  merges (existing ids overwritten), reloads state.

## 6. Share an imported template by link — DONE

"Share" on an imported template copies a URL: `/#t=<base64url(JSON)>`.
Opening it prompts "Add template X?" and saves to localStorage. Logos can be
~1MB data URIs — far past safe URL length — so: if the encoded payload
exceeds 32KB the logo is stripped and the copier is told the recipient adds
their own. No server, nothing stored anywhere.

## Deferred (next round)

- Second/third layout (`modern-minimal`, `bordered-grid`) — biggest unlock
  for the import flow, but each is a full design pass of its own.
- Server-side template gallery (share links but persistent/public).
- Font-size fitting by real text measurement (canvas measure in the browser,
  passed as a hint) if the heuristic proves too coarse.
