/**
 * The typefaces logankuzyk.com uses, so the new tab matches the site it draws photos from.
 *
 * Self-hosted through @fontsource (see entrypoints/newtab/main.tsx). No remote font requests,
 * so the new tab works offline and needs no host permissions.
 */
export const FONTS = {
  system: {
    label: 'System',
    stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  geist: { label: 'Geist', stack: "'Geist Sans', ui-sans-serif, system-ui, sans-serif" },
  'geist-mono': { label: 'Geist Mono', stack: "'Geist Mono', ui-monospace, monospace" },
  'instrument-serif': {
    label: 'Instrument Serif',
    stack: "'Instrument Serif', ui-serif, Georgia, serif",
  },
} as const

export type FontId = keyof typeof FONTS

export const FONT_IDS = Object.keys(FONTS) as FontId[]

/**
 * The CSS stack for a stored font id. Settings sync between devices, so a browser can be
 * holding an id from a newer (or older) version of the extension; those fall back to system.
 */
export const fontStack = (id: string): string => (FONTS[id as FontId] ?? FONTS.system).stack
