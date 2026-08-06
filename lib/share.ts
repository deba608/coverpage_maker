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
const MAX_SHARE_BYTES = 32_000

function toBase64Url(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
}

export function buildShareUrl(meta: TemplateMeta): { url: string; logoStripped: boolean } {
  let payload = JSON.stringify(meta)
  let logoStripped = false
  if (payload.length > MAX_SHARE_BYTES && meta.brand.logo?.startsWith('data:')) {
    payload = JSON.stringify({ ...meta, brand: { ...meta.brand, logo: undefined } })
    logoStripped = true
  }
  const url = `${window.location.origin}/#t=${toBase64Url(payload)}`
  return { url, logoStripped }
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
