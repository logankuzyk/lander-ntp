import { useEffect, useState } from 'preact/hooks'

import type { Settings } from '@/settings/schema'

import { type CalloutInfo, NEWS } from './callouts'
import type { Onboarding } from './storage'

/**
 * The news callout to show, if any: the first one not yet dismissed that still has something
 * to point out. Null for `onboarding` or `settings` while they aren't known, and until the
 * welcome has been answered. One whose feature turns out to be unavailable holds the others
 * back rather than being skipped, so they keep their order when it returns.
 */
export function useNews(
  onboarding: Onboarding | null,
  settings: Settings | null,
): CalloutInfo | null {
  const candidate =
    (onboarding?.welcomed &&
      settings &&
      NEWS.find(
        (callout) =>
          !onboarding.dismissed.includes(callout.id) && (callout.relevant?.(settings) ?? true),
      )) ||
    null
  const [availableId, setAvailableId] = useState<string | null>(null)

  useEffect(() => {
    if (!candidate) return
    let active = true
    void (candidate.available?.() ?? Promise.resolve(true)).then((available) => {
      if (active && available) setAvailableId(candidate.id)
    })
    return () => {
      active = false
    }
  }, [candidate])

  return candidate && candidate.id === availableId ? candidate : null
}
