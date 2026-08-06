'use client'

/**
 * Unified class-list reader: CSV/TSV text files AND Excel workbooks (.xlsx/.xls).
 *
 * All paths return the same string[][] rows (header + data), so the existing
 * matchCsv/parseDelimited pipeline needs no changes. Column names come out as
 * the raw cell text the user typed — the caller normalises casing.
 */

import { parseDelimited } from './csv'

type Row = string[]

/** Reads any supported file and returns rows (header first). */
export async function readClassList(file: File): Promise<Row[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return readExcel(file)
  }
  return parseDelimited(await file.text())
}

async function readExcel(file: File): Promise<Row[]> {
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  // Without a schema the library returns SheetData = (CellValue|null)[][].
  const raw = await readXlsxFile(file) as unknown as (unknown)[][]
  return raw.map((row) =>
    (row as unknown[]).map((cell) => (cell === null || cell === undefined ? '' : String(cell))),
  )
}
