'use client'

/* eslint-disable @next/next/no-img-element -- thumbnails are tiny static or
 * data-URI images; the optimizer buys nothing here. */
import Link from 'next/link'
import type { TemplateMeta } from '@/lib/templates/types'

/**
 * The template shelf: one card per template, plus the dashed "import" slot.
 * Imported templates carry a small badge and a remove control.
 */
export function TemplatePicker({
  templates,
  customIds,
  selectedId,
  onSelect,
  onDelete,
}: {
  templates: TemplateMeta[]
  customIds: Set<string>
  selectedId: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {templates.map((t) => {
        const selected = t.id === selectedId
        const custom = customIds.has(t.id)
        return (
          <div key={t.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              aria-pressed={selected}
              className={`block rounded-[2px] border p-2 text-left transition-colors ${
                selected
                  ? 'border-ink bg-sheet shadow-[2px_2px_0_rgba(28,43,107,0.18)]'
                  : 'border-rule bg-sheet hover:border-ink'
              }`}
            >
              <img
                src={t.thumbnail}
                alt=""
                width={96}
                height={136}
                className="h-[136px] w-[96px] rounded-[1px] border border-rule bg-white object-cover object-top"
              />
              <p className="mt-1.5 w-[96px] truncate text-[0.6875rem] font-semibold text-ink">
                {t.name}
              </p>
              <p className="w-[96px] text-[0.625rem] text-pencil">
                {custom ? 'Imported' : 'Built-in'}
              </p>
            </button>
            {custom && (
              <button
                type="button"
                aria-label={`Remove ${t.name}`}
                onClick={() => onDelete(t.id)}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full
                           border border-rule bg-sheet text-[0.65rem] leading-none text-pencil
                           hover:border-margin hover:text-margin"
              >
                ✕
              </button>
            )}
          </div>
        )
      })}

      <Link
        href="/import"
        className="grid h-[188px] w-[112px] shrink-0 place-items-center rounded-[2px] border
                   border-dashed border-rule bg-transparent text-center transition-colors
                   hover:border-ink"
      >
        <span className="px-2">
          <span className="mb-1 block text-xl leading-none text-ink">+</span>
          <span className="block text-[0.6875rem] font-semibold text-ink">Import your college</span>
          <span className="block text-[0.625rem] text-pencil">from a PDF</span>
        </span>
      </Link>
    </div>
  )
}
