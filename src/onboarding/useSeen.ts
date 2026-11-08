import { useCallback, useEffect, useState } from 'preact/hooks'

import { onboardingItem } from './storage'

let queuedWrites: Promise<void> = Promise.resolve()

async function addSeenIds(ids: readonly string[]): Promise<boolean> {
  const current = await onboardingItem.getValue()
  if (!current) return false
  const nextIds = [...new Set(ids.filter((id) => !current.dismissed.includes(id)))]
  if (nextIds.length > 0) {
    await onboardingItem.setValue({ ...current, dismissed: [...current.dismissed, ...nextIds] })
  }
  return true
}

/** Add unseen mark IDs in one synced onboarding write, preserving every other field and ID. */
export function recordSeen(ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return onboardingItem.getValue().then((record) => record !== null)

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('lander-onboarding-seen', () => addSeenIds(ids))
  }

  const write = queuedWrites.then(() => addSeenIds(ids))
  queuedWrites = write.then(
    () => undefined,
    () => undefined,
  )
  return write
}

/** Whether this ID was seen when the current surface mounted, and a way to mark it seen. */
export function useSeen(id: string): { markSeen: () => Promise<void>; seen: boolean | null } {
  const [seen, setSeen] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    const update = (record: Awaited<ReturnType<typeof onboardingItem.getValue>>) => {
      if (active && record) setSeen(record.dismissed.includes(id))
    }
    const unwatch = onboardingItem.watch(update)
    void onboardingItem.getValue().then((record) => {
      update(record)
    })
    return () => {
      active = false
      unwatch()
    }
  }, [id])

  const markSeen = useCallback(async () => {
    if (await recordSeen([id])) setSeen(true)
  }, [id])

  return { markSeen, seen }
}
