import { fakeBrowser } from 'wxt/testing/fake-browser'

import { onboardingItem } from './v0.2.3/onboarding'
import { type Settings, settingsItem } from './v0.2.3/settings'

/** What `chrome.storage.sync.get(null)` returns: every synced key, as the browser holds it. */
export type RawSync = Record<string, unknown>

/** The sync area as a v0.2.3 device would meet it. */
const load = async (rawSync: RawSync) => {
  await fakeBrowser.storage.sync.clear()
  await fakeBrowser.storage.sync.set(rawSync)
}

/**
 * What a device on v0.2.3 draws from this synced storage, read with the frozen copy of its
 * check. `fellBack` is true when it rejected a stored `settings` value and drew the defaults;
 * nothing stored at all is a new install, not a fall back.
 */
export async function asV023(rawSync: RawSync) {
  await load(rawSync)
  const settings = await settingsItem.getValue()
  return {
    fellBack: settings === settingsItem.fallback,
    onboarding: await onboardingItem.getValue(),
    settings,
  }
}

/**
 * What the v0.2.3 panel does for any change: read the settings through its check, spread the
 * change over them and write the whole value back. Returns the synced storage afterwards, as
 * a dump (`raw`), with what v0.2.3 then draws from it.
 */
export async function saveLikeV023(rawSync: RawSync, change: Partial<Settings>) {
  await load(rawSync)
  await settingsItem.setValue({ ...(await settingsItem.getValue()), ...change })
  const raw = await fakeBrowser.storage.sync.get(null)
  return { ...(await asV023(raw)), raw }
}
