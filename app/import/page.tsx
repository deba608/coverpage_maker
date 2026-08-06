import Link from 'next/link'
import { ImportEditor } from '@/components/ImportEditor'

export const metadata = { title: 'Import a template — Coverpage Maker' }

export default function ImportPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4">
          <Link
            href="/"
            className="btn-ghost inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium"
          >
            ← Back to templates
          </Link>
          <div className="name-slip">
            <h1 className="text-lg sm:text-xl font-semibold leading-tight">
              Import your college&apos;s coverpage
            </h1>
          </div>
        </div>
        <p className="max-w-xl text-sm">
          Drop the PDF you already use. The college name, seal, and the blanks you fill in are
          picked out automatically — check them, fix anything, save.
        </p>
      </header>
      <ImportEditor />
    </div>
  )
}
