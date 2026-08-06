import Link from 'next/link'
import { ImportEditor } from '@/components/ImportEditor'

export const metadata = { title: 'Import a template — Coverpage Maker' }

export default function ImportPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <Link href="/" className="text-sm text-pencil underline-offset-2 hover:underline">
          ← Back to templates
        </Link>
        <div className="name-slip mt-3">
          <h1 className="text-xl leading-tight sm:text-2xl">Import your college&apos;s coverpage</h1>
        </div>
        <p className="mt-2 max-w-xl text-sm">
          Drop the PDF you already use. The college name, seal, and the blanks you fill in are
          picked out automatically — check them, fix anything, save.
        </p>
      </header>
      <ImportEditor />
    </div>
  )
}
