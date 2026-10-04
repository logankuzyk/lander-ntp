import * as v from 'valibot'
import { storage } from 'wxt/utils/storage'

export type Onboarding = {
  /** Ids of the news callouts that have been seen off, or never needed showing; see ./callouts. */
  dismissed: string[]
  /** False from a fresh install until the welcome has been answered. */
  welcomed: boolean
}

const OnboardingSchema = v.object({ dismissed: v.array(v.string()), welcomed: v.boolean() })

/** Anything in another shape counts as nothing stored. */
const current = (value: unknown): Onboarding | null => {
  const result = v.safeParse(OnboardingSchema, value)
  return result.success ? result.output : null
}

const stored = storage.defineItem<Onboarding | null>('sync:onboarding', { fallback: null })

/**
 * A new install's record until the welcome is answered. Kept on this device: at install the
 * synced record may not have arrived yet, and writing over it would undo it on every device.
 */
export const pendingItem = storage.defineItem<Onboarding | null>('local:onboarding', {
  fallback: null,
})

/**
 * What this person has already been shown. Synced like the settings, so a second device
 * doesn't welcome them again; the synced record wins over this device's pending one. Null
 * until the background script has seen the install or update (see ./install), and nothing is
 * shown until then.
 */
export const onboardingItem = {
  fallback: null,
  getValue: async (): Promise<Onboarding | null> =>
    current(await stored.getValue()) ?? current(await pendingItem.getValue()),
  setValue: (value: Onboarding | null): Promise<void> => stored.setValue(value),
  watch: (callback: (value: Onboarding | null) => void): (() => void) => {
    const notify = () => void onboardingItem.getValue().then(callback)
    const unwatchStored = stored.watch(notify)
    const unwatchPending = pendingItem.watch(notify)
    return () => {
      unwatchStored()
      unwatchPending()
    }
  },
}
