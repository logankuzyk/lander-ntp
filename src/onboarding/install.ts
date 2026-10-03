import { NEWS } from './callouts'
import { onboardingItem } from './storage'

/**
 * Called by the background script with the reason the browser gives `runtime.onInstalled`,
 * which is the only thing that tells a new install from an update.
 *
 * A new install is welcomed, and skips the news: the welcome tour covers it. An update from a
 * version that kept no record is not welcomed, and gets all of the news. Once there is a
 * record it is left alone, whether this device wrote it or another one synced it here: news
 * added later shows to anyone who hasn't dismissed it.
 */
export async function recordInstall(reason: string): Promise<void> {
  if (reason !== 'install' && reason !== 'update') return
  if (await onboardingItem.getValue()) return
  await onboardingItem.setValue(
    reason === 'install'
      ? { dismissed: NEWS.map(({ id }) => id), welcomed: false }
      : { dismissed: [], welcomed: true },
  )
}
