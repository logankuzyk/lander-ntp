import { defineGuardedItem } from '@/storage/guard'

export type Background = {
  [key: string]: unknown
  colour: string
  favouritesOnly: boolean
  kind: string
  v: 1
}

export const BACKGROUND_COLOURS = [
  '#ffffff',
  '#f2e8cf',
  '#a8dadc',
  '#457b9d',
  '#1d3557',
  '#e63946',
  '#f4a261',
  '#2a9d8f',
] as const

export const DEFAULT_BACKGROUND: Background = {
  colour: BACKGROUND_COLOURS[0],
  favouritesOnly: false,
  kind: 'photo',
  v: 1,
}

/** Unknown saved kinds remain intact for a newer version and behave as photos here. */
export const displayKind = (background: Background): 'colour' | 'photo' =>
  background.kind === 'colour' ? 'colour' : 'photo'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function checkBackground(raw: unknown): Background {
  if (!isRecord(raw)) return DEFAULT_BACKGROUND

  return {
    ...raw,
    colour:
      typeof raw.colour === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.colour)
        ? raw.colour
        : BACKGROUND_COLOURS[0],
    favouritesOnly:
      typeof raw.favouritesOnly === 'boolean'
        ? raw.favouritesOnly
        : DEFAULT_BACKGROUND.favouritesOnly,
    kind: typeof raw.kind === 'string' ? raw.kind : DEFAULT_BACKGROUND.kind,
    v: 1,
  }
}

const guarded = defineGuardedItem<Background>({
  check: checkBackground,
  fallback: DEFAULT_BACKGROUND,
  key: 'sync:background',
  unreadable: (raw) => !isRecord(raw) || typeof raw.kind !== 'string',
  version: 1,
})

export const backgroundItem = {
  fallback: DEFAULT_BACKGROUND,
  getValue: async (): Promise<Background> => (await guarded.read()).value,
  key: guarded.key,
  read: guarded.read,
  setValue: (value: Background): Promise<void> => guarded.write(value),
  watch: (callback: (value: Background | null, newer?: boolean) => void): (() => void) =>
    guarded.watch((read) => callback(read?.value ?? null, read?.newer)),
}
