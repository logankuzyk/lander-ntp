export const BACKGROUND_HINT_KEY = 'lander:background-hint'

type BackgroundHint = { colour: string; ink: '#111' | '#fff'; kind: string }

export function applyBackgroundHint(root: HTMLElement, read: () => string | null): void {
  try {
    const raw = read()
    if (!raw) return
    const hint = JSON.parse(raw) as Partial<BackgroundHint>
    if (
      hint.kind !== 'colour' ||
      typeof hint.colour !== 'string' ||
      !/^#[0-9a-fA-F]{6}$/.test(hint.colour) ||
      (hint.ink !== '#111' && hint.ink !== '#fff')
    ) {
      return
    }
    root.style.setProperty('--color-bg', hint.colour)
    root.dataset.ink = hint.ink === '#111' ? 'dark' : 'light'
  } catch {
    // A missing or unavailable hint must not keep the new tab from rendering.
  }
}

if (typeof document !== 'undefined') {
  applyBackgroundHint(document.documentElement, () => localStorage.getItem(BACKGROUND_HINT_KEY))
}
