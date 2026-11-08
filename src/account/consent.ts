import { browser } from 'wxt/browser'

const SIGN_IN_DATA = ['locationInfo', 'personallyIdentifyingInfo', 'authenticationInfo'] as const

/** Ask before sending an email address or syncing a Layout from this device. */
export async function requestSignInConsent(): Promise<boolean> {
  if (import.meta.env.BROWSER !== 'firefox') return true
  try {
    // `data_collection` is newer than the typings.
    return await browser.permissions.request({ data_collection: [...SIGN_IN_DATA] } as Parameters<
      typeof browser.permissions.request
    >[0])
  } catch {
    return false
  }
}

/** Whether Firefox still allows the data this device may send to account sync. */
export async function signInConsented(): Promise<boolean> {
  if (import.meta.env.BROWSER !== 'firefox') return true
  try {
    return await browser.permissions.contains({ data_collection: [...SIGN_IN_DATA] } as Parameters<
      typeof browser.permissions.contains
    >[0])
  } catch {
    return false
  }
}
