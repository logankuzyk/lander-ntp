/**
 * Self-hosted through @fontsource (see entrypoints/newtab/main.tsx). No remote font requests,
 * so the new tab works offline and needs no host permissions.
 */
export const FONTS = {
  system: {
    label: 'System',
    stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  inter: { label: 'Inter', stack: "'Inter', system-ui, sans-serif" },
  fraunces: { label: 'Fraunces', stack: "'Fraunces', Georgia, 'Times New Roman', serif" },
  'space-grotesk': { label: 'Space Grotesk', stack: "'Space Grotesk', system-ui, sans-serif" },
  'jetbrains-mono': {
    label: 'JetBrains Mono',
    stack: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace",
  },
} as const

export type FontId = keyof typeof FONTS

export const FONT_IDS = Object.keys(FONTS) as FontId[]
