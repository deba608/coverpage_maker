'use client'

import type { TemplateMeta } from '@/lib/templates/types'
import { templateMetaSchema } from '@/lib/templates/schema'

/**
 * Template sharing without a server: the whole definition rides in the URL
 * fragment (`/#t=<base64url JSON>`). Fragments never reach any server, so
 * nothing is uploaded or stored anywhere.
 *
 * Logos are the size problem — a data-URI seal can be ~1MB, far past what
 * URLs survive. Past MAX_SHARE_BYTES the logo is stripped and the caller
 * told, so the link stays paste-able in WhatsApp/mail.
 */
/** Longest share URL we will emit — past ~32k chars WhatsApp/mail truncate. */
const MAX_SHARE_BYTES = 32_000

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  // String.fromCharCode has an argument-count limit (~65k); spreading a big
  // payload overflows the stack, so convert in 32k chunks.
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
}

export function buildShareUrl(meta: TemplateMeta): { url: string; logoStripped: boolean } {
  // Measure the *encoded* URL — base64url inflates the payload by a third,
  // so a payload under the cap can still produce an over-long link.
  const make = (m: TemplateMeta) =>
    `${window.location.origin}/#t=${toBase64Url(JSON.stringify(m))}`
  let url = make(meta)
  let logoStripped = false
  if (url.length > MAX_SHARE_BYTES && meta.brand.logo?.startsWith('data:')) {
    url = make({ ...meta, brand: { ...meta.brand, logo: undefined } })
    logoStripped = true
  }
  return { url, logoStripped }
}

/**
 * Clipboard API first; a hidden-textarea fallback for plain-http origins,
 * where `navigator.clipboard` is undefined and writeText would reject.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

/** Reads a shared template out of the current URL hash, if one is there. */
export function readSharedTemplate(): TemplateMeta | null {
  const match = window.location.hash.match(/^#t=([A-Za-z0-9_-]+)$/)
  if (!match) return null
  try {
    const parsed = templateMetaSchema.safeParse(JSON.parse(fromBase64Url(match[1])))
    // 'custom' layouts ship code, which a URL must never smuggle in.
    if (!parsed.success || parsed.data.layout === 'custom') return null
    return parsed.data as TemplateMeta
  } catch {
    return null
  }
}

export function clearShareHash(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search)
}
