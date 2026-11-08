import { defineGuardedItem } from '@/storage/guard'

export type Favourites = { [key: string]: unknown; ids: string[]; v: 1 }

export const DEFAULT_FAVOURITES: Favourites = { ids: [], v: 1 }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function checkFavourites(raw: unknown): Favourites {
  if (!isRecord(raw)) return DEFAULT_FAVOURITES
  const ids = Array.isArray(raw.ids)
    ? [...new Set(raw.ids.filter((id): id is string => typeof id === 'string'))]
    : []
  return { ...raw, ids, v: 1 }
}

const guarded = defineGuardedItem<Favourites>({
  check: checkFavourites,
  fallback: DEFAULT_FAVOURITES,
  key: 'sync:favourites',
  unreadable: (raw) => !isRecord(raw),
  version: 1,
})

export const favouritesItem = {
  fallback: DEFAULT_FAVOURITES,
  getValue: async (): Promise<Favourites> => (await guarded.read()).value,
  key: guarded.key,
  read: guarded.read,
  setValue: (value: Favourites): Promise<void> => guarded.write(value),
  watch: (callback: (value: Favourites | null, newer?: boolean) => void): (() => void) =>
    guarded.watch((read) => callback(read?.value ?? null, read?.newer)),
}

export const isFavourite = (ids: readonly string[], id: string): boolean => ids.includes(id)

/** Add an id newest-first, or remove it if it is already present. */
export function toggleFavourite(ids: readonly string[], id: string): string[] {
  const unique = [...new Set(ids)]
  return isFavourite(unique, id) ? unique.filter((candidate) => candidate !== id) : [id, ...unique]
}

/** Favourite ids still in the photo list; absent ids stay in storage for a later manifest. */
export function presentFavourites<T extends { id: string }>(
  ids: readonly string[],
  photos: readonly T[],
): string[] {
  const available = new Set(photos.map(({ id }) => id))
  return ids.filter((id) => available.has(id))
}
