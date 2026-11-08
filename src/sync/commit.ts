import * as v from 'valibot'

import { layoutItem } from '@/layout/storage'
import { onboardingItem } from '@/onboarding/storage'
import { settingsItem } from '@/settings/storage'
import { createWriteQueue, type SaveResult } from '@/storage/writeQueue'

import { hasNewerVersion, type SyncedItemKey, syncedShapes } from './shapes'

const queues = {
  layout: createWriteQueue((value: unknown) => layoutItem.setRemoteValue(value)),
  onboarding: createWriteQueue((value: unknown) => onboardingItem.setValue(value as never)),
  settings: createWriteQueue((value: unknown) => settingsItem.setValue(value as never)),
} satisfies Record<SyncedItemKey, ReturnType<typeof createWriteQueue<unknown>>>

/** Commit one server item through its ordinary storage item, serially and with latest-wins writes. */
export function commitPulledItem(key: SyncedItemKey, value: unknown): Promise<SaveResult> {
  if (key === 'layout') {
    const shapeReadable = v.safeParse(syncedShapes.layout.schema, value).success
    const currentVersion = syncedShapes.layout.check(value).ok
    const newerVersion =
      hasNewerVersion(value, syncedShapes.layout.version) &&
      typeof value === 'object' &&
      value !== null &&
      'v' in value &&
      Number.isSafeInteger(value.v)
    if (!shapeReadable || (!currentVersion && !newerVersion)) return Promise.resolve('refused')
  } else if (!syncedShapes[key].check(value).ok) {
    return Promise.resolve('refused')
  }
  return queues[key].save(value)
}
