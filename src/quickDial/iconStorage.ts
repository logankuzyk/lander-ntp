import { storage } from 'wxt/utils/storage'

import { ICON_DATA_URL_LIMIT } from '@/quickDial/icon'
import { defineGuardedItem, NewerVersionError } from '@/storage/guard'
import { createWriteQueue } from '@/storage/writeQueue'

export type StoredIcon = { [key: string]: unknown; data: string; v: 1 }
const EMPTY: StoredIcon = { data: '', v: 1 }
const dataUrl = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= ICON_DATA_URL_LIMIT &&
  /^data:image\/(?:webp|png);base64,[a-z\d+/]*={0,2}$/i.test(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function checkIcon(raw: unknown): StoredIcon {
  if (!isRecord(raw)) return EMPTY
  return { ...raw, data: dataUrl(raw.data) ? raw.data : '', v: 1 }
}

const items = new Map<string, ReturnType<typeof makeItem>>()
function makeItem(id: string) {
  const guarded = defineGuardedItem<StoredIcon>({
    check: checkIcon,
    fallback: EMPTY,
    key: `sync:icon:${id}`,
    unreadable: (raw) => !isRecord(raw) || !dataUrl(raw.data),
    version: 1,
  })
  const queue = createWriteQueue(
    (value: StoredIcon) => guarded.write(value),
    (error) => error instanceof NewerVersionError,
  )
  const write = async (value: StoredIcon) => {
    const result = await queue.save(value)
    if (result === 'refused') throw new NewerVersionError(guarded.key)
    if (result !== 'saved') throw new Error('The icon could not be saved.')
  }
  return {
    fallback: guarded.fallback,
    getValue: async () => (await guarded.read()).value,
    key: guarded.key,
    read: guarded.read,
    setValue: write,
    watch: (callback: (value: StoredIcon | null, newer?: boolean) => void) =>
      guarded.watch((read) => callback(read?.value ?? null, read?.newer)),
    write,
  }
}

/** The guarded synced item for one Quick dial icon. */
export function iconItem(id: string) {
  let item = items.get(id)
  if (!item) {
    item = makeItem(id)
    items.set(id, item)
  }
  return item
}

const newId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map((byte) => (byte % 36).toString(36)).join('')
}

/** Stores an icon as a new item; an existing item is never edited in place. */
export async function saveIcon(data: string): Promise<string> {
  if (!dataUrl(data)) throw new TypeError('The icon data is not small enough to sync.')
  const id = newId()
  await iconItem(id).setValue({ data, v: 1 })
  return id
}

/** Removes an icon after no Widget or Undo notice refers to it. */
export async function deleteIcon(id: string): Promise<void> {
  await storage.removeItem(`sync:icon:${id}`)
  items.delete(id)
}
