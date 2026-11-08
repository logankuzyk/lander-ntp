import { DEFAULT_SETTINGS } from '@/settings/schema'

export type SyncAction = 'ask' | 'download' | 'nothing' | 'upload'

type SyncItems = Record<string, unknown>

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const itemVersion = (value: unknown): number => {
  const version = asRecord(value).v
  return typeof version === 'number' && Number.isSafeInteger(version) ? version : 1
}

/** Stable JSON for comparing stored sync values, independent of object key insertion order. */
export function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canon(item)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

const arranged = (items: SyncItems): boolean =>
  Object.hasOwn(items, 'layout') ||
  (Object.hasOwn(items, 'settings') && canon(items.settings) !== canon(DEFAULT_SETTINGS))

/** Decide how to reconcile a browser and account on the first sign-in. */
export function planFirstSignIn(local: SyncItems, remote: SyncItems): SyncAction {
  if (!arranged(local) && !arranged(remote)) return 'nothing'
  if (!arranged(local)) return 'download'
  if (!arranged(remote)) return 'upload'

  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  for (const key of keys) {
    if (key !== 'onboarding' && canon(local[key]) !== canon(remote[key])) return 'ask'
  }
  return 'nothing'
}

/** Merge onboarding so every device keeps callouts already dismissed on any device. */
export function mergeOnboarding(a: unknown, b: unknown): Record<string, unknown> {
  const left = asRecord(a)
  const right = asRecord(b)
  const dismissed = new Set([
    ...(Array.isArray(left.dismissed)
      ? left.dismissed.filter((id): id is string => typeof id === 'string')
      : []),
    ...(Array.isArray(right.dismissed)
      ? right.dismissed.filter((id): id is string => typeof id === 'string')
      : []),
  ])
  return {
    ...right,
    ...left,
    dismissed: [...dismissed].sort(),
    welcomed: left.welcomed === true || right.welcomed === true,
  }
}

/** Choose remote items changed since the previous server snapshot when local stayed unchanged. */
export function planPull(local: SyncItems, remote: SyncItems, lastSynced: SyncItems): SyncItems {
  const pulled: SyncItems = {}
  for (const [key, value] of Object.entries(remote)) {
    const localVersion = itemVersion(local[key])
    const remoteVersion = itemVersion(value)
    if (remoteVersion < localVersion) continue
    if (remoteVersion > localVersion) {
      pulled[key] = value
      continue
    }
    if (key === 'onboarding') {
      pulled[key] = mergeOnboarding(local[key], value)
      continue
    }
    const remoteChanged = canon(value) !== canon(lastSynced[key])
    const localChanged = canon(local[key]) !== canon(lastSynced[key])
    if (remoteChanged && !localChanged) pulled[key] = value
  }
  return pulled
}
