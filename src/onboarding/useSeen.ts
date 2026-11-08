import { useCallback, useEffect, useState } from 'preact/hooks'

import { onboardingItem } from './storage'

/** Add unseen mark IDs in one synced onboarding write, preserving every other field and ID. */
export async function recordSeen(ids: readonly string[]): Promise<void> {
  const current = await onboardingItem.getValue()
  if (!current) return
  const nextIds = [...new Set(ids.filter((id) => !current.dismissed.includes(id)))]
  if (nextIds.length > 0) {
    await onboardingItem.setValue({ ...current, dismissed: [...current.dismissed, ...nextIds] })
  }
}

/** Whether this ID was seen when the current surface mounted, and a way to mark it seen. */
export function useSeen(id: string): { markSeen: () => Promise<void>; seen: boolean | null } {
  const [seen, setSeen] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    void onboardingItem.getValue().then((record) => {
      if (active) setSeen(record === null || record.dismissed.includes(id))
    })
    return () => {
      active = false
    }
  }, [id])

  const markSeen = useCallback(async () => {
    await recordSeen([id])
    setSeen(true)
  }, [id])

  return { markSeen, seen }
}
