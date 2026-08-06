'use client'

/* eslint-disable @next/next/no-img-element -- thumbnails are tiny static PNGs;
 * the optimizer buys nothing here. */
import type { TemplateMeta } from '@/lib/templates/types'

/** Thumbnail grid. One card per registered template. */
export function TemplatePicker({
  templates,
  selectedId,
  onSelect,
}: {
  templates: TemplateMeta[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          aria-pressed={t.id === selectedId}
          className={`shrink-0 rounded-lg border-2 p-2 text-left transition-colors ${
            t.id === selectedId
              ? 'border-neutral-900 dark:border-neutral-100'
              : 'border-transparent hover:border-neutral-300 dark:hover:border-neutral-700'
          }`}
        >
          <img
            src={t.thumbnail}
            alt=""
            width={110}
            height={156}
            className="rounded-sm border border-neutral-200 bg-white shadow-sm dark:border-neutral-800"
          />
          <p className="mt-2 w-[110px] truncate text-xs font-medium">{t.name}</p>
        </button>
      ))}
    </div>
  )
}
