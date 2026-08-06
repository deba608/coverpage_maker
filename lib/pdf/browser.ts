import type { Browser } from 'puppeteer-core'

/**
 * One Chromium per process, two ways of getting it:
 *
 * - development/tests: the full `puppeteer` package's bundled Chrome
 * - production (Vercel): `puppeteer-core` driving `@sparticuz/chromium`,
 *   a Lambda-sized binary — a normal Chrome install doesn't exist there
 *
 * The instance is cached per warm lambda; only a cold start pays the ~2s
 * launch. `browser.connected` guards against reusing one that crashed.
 */
let cached: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (cached?.connected) return cached

  if (process.env.NODE_ENV !== 'production') {
    const puppeteer = (await import('puppeteer')).default
    cached = (await puppeteer.launch({ headless: true })) as unknown as Browser
    return cached
  }

  const chromium = (await import('@sparticuz/chromium')).default
  const puppeteer = (await import('puppeteer-core')).default
  cached = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
  return cached
}
