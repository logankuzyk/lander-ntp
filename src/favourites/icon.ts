import { browser } from 'wxt/browser'

/**
 * Chromium's own favicon cache. Firefox has no equivalent API, and third-party favicon
 * services would leak which sites are in the list, so Firefox uses the monogram instead.
 */
export function faviconUrl(
  url: string,
  size = 32,
  target: string = import.meta.env.BROWSER,
): string | null {
  if (target === 'firefox') return null
  // '/_favicon/' isn't a bundled public path, so build on the extension's base URL.
  const base = browser.runtime.getURL('/')
  return `${base}_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`
}

const MONOGRAM_COLORS = [
  '#b4533a',
  '#b07d2b',
  '#5d7f3a',
  '#347f72',
  '#3a6ea8',
  '#6b5aa6',
  '#a24a7c',
]

/** Stable per-site colour, so a site keeps the same monogram between sessions. */
export function monogram(title: string, url: string): { letter: string; color: string } {
  const source = title.trim() || url
  const letter = [...source][0]?.toUpperCase() ?? '?'
  let hash = 0
  for (const char of url) hash = (hash * 31 + char.charCodeAt(0)) % 1_000_003
  return { letter, color: MONOGRAM_COLORS[hash % MONOGRAM_COLORS.length] as string }
}
