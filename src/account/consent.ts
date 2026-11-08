import { browser } from 'wxt/browser'

import config from './config'
import { accountHostPermission } from './serverAddress'

const SIGN_IN_DATA = ['locationInfo', 'personallyIdentifyingInfo', 'authenticationInfo'] as const
const ACCOUNT_ORIGIN = [accountHostPermission(config.serverUrl)]

/** Ask before sending an email address or syncing a Layout from this device. */
export async function requestSignInConsent(): Promise<boolean> {
  try {
    // `data_collection` is newer than the typings. The origin is an optional host permission.
    const permissions =
      import.meta.env.BROWSER === 'firefox'
        ? { data_collection: [...SIGN_IN_DATA], origins: ACCOUNT_ORIGIN }
        : { origins: ACCOUNT_ORIGIN }
    return await browser.permissions.request(
      permissions as Parameters<typeof browser.permissions.request>[0],
    )
  } catch {
    return false
  }
}

/** Whether this device still allows the data and server origin the account client needs. */
export async function signInConsented(): Promise<boolean> {
  try {
    const permissions =
      import.meta.env.BROWSER === 'firefox'
        ? { data_collection: [...SIGN_IN_DATA], origins: ACCOUNT_ORIGIN }
        : { origins: ACCOUNT_ORIGIN }
    return await browser.permissions.contains(
      permissions as Parameters<typeof browser.permissions.contains>[0],
    )
  } catch {
    return false
  }
}
