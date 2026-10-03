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
 * What this person has already been shown. Synced like the settings, so a second device
 * doesn't welcome them again. Null until the background script has seen the install or update
 * (see ./install), and nothing is shown until then.
 */
export const onboardingItem = {
  fallback: null,
  getValue: async (): Promise<Onboarding | null> => current(await stored.getValue()),
  setValue: (value: Onboarding | null): Promise<void> => stored.setValue(value),
  watch: (callback: (value: Onboarding | null) => void): (() => void) =>
    stored.watch((value) => callback(current(value))),
}
