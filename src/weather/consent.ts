import { browser } from 'wxt/browser'

/**
 * Firefox has the user agree to each kind of data an extension sends anywhere, and the place
 * the weather is for counts as location. Must be called from a click. Other browsers have no
 * such prompt; there, switching the widget on is the agreement.
 */
export async function allowLocation(): Promise<boolean> {
  if (import.meta.env.BROWSER !== 'firefox') return true
  try {
    // `data_collection` is newer than the typings.
    return await browser.permissions.request({ data_collection: ['locationInfo'] } as Parameters<
      typeof browser.permissions.request
    >[0])
  } catch {
    return false
  }
}

/**
 * Whether that agreement stands on this device. Settings sync and the agreement doesn't, so a
 * device can be told to show the weather without anyone having agreed there; it can also be
 * taken back from the browser's add-on settings.
 */
export async function locationConsented(): Promise<boolean> {
  if (import.meta.env.BROWSER !== 'firefox') return true
  try {
    return await browser.permissions.contains({ data_collection: ['locationInfo'] } as Parameters<
      typeof browser.permissions.contains
    >[0])
  } catch {
    return false
  }
}
