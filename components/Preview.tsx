'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/** A4 at 96dpi. The scale factor divides the container width by this. */
const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

/**
 * Shows an A4 page scaled to fit its container. Scaling the whole page with
 * one transform keeps the preview geometrically identical to the PDF at any
 * viewport size — nothing reflows, everything just shrinks.
 */
export function Preview({
  children,
  onScale,
}: {
  children: React.ReactNode
  onScale?: (scale: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Measure before first paint so the page never flashes at the default
    // scale; the observer keeps it correct through resizes.
    const initial = el.getBoundingClientRect().width / A4_WIDTH_PX
    if (initial > 0 && Number.isFinite(initial)) {
      setScale(initial)
      onScale?.(initial)
    }
    const observer = new ResizeObserver(([entry]) => {
      const s = entry.contentRect.width / A4_WIDTH_PX
      setScale(s)
      onScale?.(s)
    })
    observer.observe(el)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; onScale is stable in the one caller that passes it
  }, [])

  return (
    <div ref={containerRef} className="w-full">
      <div
        style={{ height: A4_HEIGHT_PX * scale }}
        className="overflow-hidden rounded-[2px] border border-rule bg-sheet shadow-[2px_2px_0_rgba(28,43,107,0.12)]"
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
