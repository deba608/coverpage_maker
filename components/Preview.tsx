'use client'

import { useEffect, useRef, useState } from 'react'

/** A4 at 96dpi. The scale factor divides the container width by this. */
const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

/**
 * Shows an A4 page scaled to fit its container. Scaling the whole page with
 * one transform keeps the preview geometrically identical to the PDF at any
 * viewport size — nothing reflows, everything just shrinks.
 */
export function Preview({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / A4_WIDTH_PX)
    })
    observer.observe(el)
    return () => observer.disconnect()
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
