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

/** Read the pending first-sign-in snapshot using the frozen record shape. */
export async function readFrozenSyncChoice(): Promise<
  | { email: string; local: Record<string, unknown>; remote: Record<string, unknown>; rev: number }
  | { email: string; state: 'complete' }
  | null
> {
  const value: unknown = (await browser.storage.local.get('sync-choice'))['sync-choice']
  if (
    typeof value !== 'object' ||
    value === null ||
    !('email' in value) ||
    typeof value.email !== 'string' ||
    !('state' in value) ||
    (value.state !== 'needs-choice' && value.state !== 'complete')
  ) {
    return null
  }
  if (value.state === 'complete') return { email: value.email, state: 'complete' }
  if (
    !('local' in value) ||
    typeof value.local !== 'object' ||
    value.local === null ||
    !('remote' in value) ||
    typeof value.remote !== 'object' ||
    value.remote === null ||
    !('rev' in value) ||
    typeof value.rev !== 'number'
  ) {
    return null
  }
  return {
    email: value.email,
    local: value.local as Record<string, unknown>,
    remote: value.remote as Record<string, unknown>,
    rev: value.rev,
  }
}

/** Read Settings with the frozen synced shape. */
export async function readFrozenSettings(): Promise<Record<string, unknown> | null> {
  const value: unknown = (await browser.storage.sync.get('settings')).settings
  if (typeof value !== 'object' || value === null || !('clock' in value) || !('photos' in value)) {
    return null
  }
  return value as Record<string, unknown>
}

/** Read onboarding with the frozen synced shape. */
export async function readFrozenOnboarding(): Promise<Record<string, unknown> | null> {
  const value: unknown = (await browser.storage.sync.get('onboarding')).onboarding
  if (
    typeof value !== 'object' ||
    value === null ||
    !('dismissed' in value) ||
    !Array.isArray(value.dismissed) ||
    !('welcomed' in value) ||
    typeof value.welcomed !== 'boolean'
  ) {
    return null
  }
  return value as Record<string, unknown>
}
