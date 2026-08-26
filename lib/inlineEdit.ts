/**
 * DOM helpers for the preview's inline text editing. Kept hook-free so
 * layouts (pure functions that must survive renderToStaticMarkup) can call
 * them from ref/handler props.
 */

/** Focuses a contentEditable node and selects its contents, Word-style. */
export function focusAndSelect(el: HTMLElement | null): void {
  if (!el || document.activeElement === el) return
  el.focus()
  try {
    const sel = window.getSelection()
    if (!sel) return
    const range = document.createRange()
    range.selectNodeContents(el)
    sel.removeAllRanges()
    sel.addRange(range)
  } catch {
    // selection is a nicety; caret placement already worked via focus()
  }
}
