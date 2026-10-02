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
