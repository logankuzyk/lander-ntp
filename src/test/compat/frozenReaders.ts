import { browser } from 'wxt/browser'

/** Read the locally stored account record as a version predating optional account fields. */
export async function readFrozenAccount(): Promise<{ email: string; token: string } | null> {
  const value: unknown = (await browser.storage.local.get('account')).account
  if (
    typeof value !== 'object' ||
    value === null ||
    !('email' in value) ||
    typeof value.email !== 'string' ||
    !('token' in value) ||
    typeof value.token !== 'string'
  ) {
    return null
  }
  return { email: value.email, token: value.token }
}
