import { useEffect, useState } from 'preact/hooks'
import { storage } from 'wxt/utils/storage'

import { type SyncedItemKey, syncedShapes } from '@/sync/shapes'

import config from './config'
import { requestSignInConsent, signInConsented } from './consent'

export type Device = {
  browser: string
  createdAt: string
  current: boolean
  id: string
  lastUsedAt: string
  os: string
}

export type AccountNotice = 'none' | 'paused-no-consent' | 'signed-out-elsewhere'

export type AccountState =
  | { devices: Device[]; email: string; notice: AccountNotice; status: 'pending-device' }
  | { devices?: Device[]; email: string; notice: AccountNotice; status: 'signed-in' }
  | { notice: AccountNotice; status: 'signed-out' }

export type AccountError =
  | 'consent-refused'
  | 'http-error'
  | 'invalid-response'
  | 'network-error'
  | 'signed-out'
  | 'too-many-tries'
  | 'wrong-code'

export type AccountResult<T = undefined> =
  { error: AccountError; ok: false } | { ok: true; value: T }
type RequestResult =
  { error: AccountError; ok: false } | { ok: true; response: Response; value: unknown }

type StoredAccount = { email: string; staleToken?: string; token?: string }

const accountItem = storage.defineItem<StoredAccount | null>('local:account', { fallback: null })
const signedOut = (): AccountState => ({ notice: 'none', status: 'signed-out' })
const json = (value: unknown): string => JSON.stringify(value)

class AccountClient {
  get state(): AccountState {
    return this.#state
  }
  #initialized = false
  #listeners = new Set<(state: AccountState) => void>()
  #state = signedOut()

  async deleteAccount(): Promise<AccountResult> {
    const guard = await this.#consentGuard()
    if (!guard.ok) return guard
    const result = await this.#authorized('/v1/account', { method: 'DELETE' })
    if (result.ok) {
      await accountItem.setValue(null)
      this.#setState(signedOut())
    }
    return result.ok ? { ok: true, value: undefined } : result
  }

  async devices(): Promise<AccountResult<Device[]>> {
    const guard = await this.#consentGuard()
    if (!guard.ok) return guard
    const result = await this.#authorized('/v1/devices')
    if (!result.ok) return result
    if (typeof result.value !== 'object' || result.value === null) {
      return { error: 'invalid-response', ok: false }
    }
    const devices = (result.value as { devices?: unknown }).devices
    if (!Array.isArray(devices)) return { error: 'invalid-response', ok: false }
    if (this.#state.status === 'signed-in')
      this.#setState({ ...this.#state, devices: devices as Device[] })
    return { ok: true, value: devices as Device[] }
  }

  async initialize(): Promise<void> {
    if (!this.#initialized) {
      this.#initialized = true
      document.addEventListener('visibilitychange', this.#visibilityHandler)
    }
    await this.#refresh()
  }

  async pushSyncItem(key: SyncedItemKey, value: unknown): Promise<AccountResult> {
    const consent = await this.#consentGuard()
    if (!consent.ok) return consent
    if (!syncedShapes[key].check(value).ok) return { error: 'invalid-response', ok: false }
    const result = await this.#authorized(`/v1/sync/${syncedShapes[key].key}`, {
      body: json({ value }),
      method: 'PUT',
    })
    return result.ok ? { ok: true, value: undefined } : result
  }

  async removeDevice(id: string): Promise<AccountResult> {
    const guard = await this.#consentGuard()
    if (!guard.ok) return guard
    const result = await this.#authorized(`/v1/devices/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (result.ok && this.#state.status === 'pending-device') {
      await this.#refresh()
    } else if (
      result.ok &&
      this.#state.status === 'signed-in' &&
      this.#state.devices?.some((device) => device.id === id && device.current)
    ) {
      await accountItem.setValue(null)
      this.#setState(signedOut())
    } else if (result.ok && this.#state.status === 'signed-in' && this.#state.devices) {
      this.#setState({
        ...this.#state,
        devices: this.#state.devices.filter((device) => device.id !== id),
      })
    }
    return result.ok ? { ok: true, value: undefined } : result
  }

  async sendCode(email: string): Promise<AccountResult> {
    const consent = requestSignInConsent()
    if (!(await consent)) {
      this.#setState({ notice: 'paused-no-consent', status: 'signed-out' })
      return { error: 'consent-refused', ok: false }
    }
    const result = await this.#request('/api/auth/email-otp/send-verification-otp', {
      body: json({ email, type: 'sign-in' }),
      method: 'POST',
    })
    if (!result.ok) return result
    if (
      typeof result.value !== 'object' ||
      result.value === null ||
      !('success' in result.value) ||
      result.value.success !== true
    ) {
      return { error: 'invalid-response', ok: false }
    }
    return { ok: true, value: undefined }
  }

  async signOut(): Promise<AccountResult> {
    const stored = await accountItem.getValue()
    if (!stored) {
      this.#setState(signedOut())
      return { ok: true, value: undefined }
    }
    if (!stored.token) {
      this.#setState(signedOut())
      return { ok: true, value: undefined }
    }
    const guard = await this.#consentGuard()
    if (!guard.ok) return guard
    const result = await this.#request('/api/auth/sign-out', {
      method: 'POST',
      token: stored.token,
    })
    if (result.ok) {
      await accountItem.setValue(
        stored.staleToken ? { email: stored.email, staleToken: stored.staleToken } : null,
      )
      this.#setState(signedOut())
      return { ok: true, value: undefined }
    }
    if (result.error === 'network-error') {
      await accountItem.setValue({ email: stored.email, staleToken: stored.token })
      this.#setState(signedOut())
      return result
    }
    await accountItem.setValue(null)
    this.#setState({ notice: 'signed-out-elsewhere', status: 'signed-out' })
    return result
  }

  subscribe(listener: (state: AccountState) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async verify(email: string, code: string): Promise<AccountResult> {
    const guard = await this.#consentGuard()
    if (!guard.ok) return guard
    const result = await this.#request('/api/auth/sign-in/email-otp', {
      body: json({ email, otp: code }),
      method: 'POST',
    })
    if (!result.ok) return result
    if (typeof result.value !== 'object' || result.value === null) {
      return { error: 'invalid-response', ok: false }
    }
    const data = result.value as { token?: unknown; user?: { email?: unknown } }
    const token =
      typeof data.token === 'string' ? data.token : result.response.headers.get('set-auth-token')
    const signedInEmail = typeof data.user?.email === 'string' ? data.user.email : email
    if (!token) return { error: 'invalid-response', ok: false }

    const old = await accountItem.getValue()
    let staleToken = old?.staleToken
    if (staleToken && staleToken !== token) {
      const revoked = await this.#request('/api/auth/sign-out', {
        method: 'POST',
        token: staleToken,
      })
      if (revoked.ok || revoked.error === 'signed-out') staleToken = undefined
    }
    await accountItem.setValue({ email: signedInEmail, staleToken, token })
    return this.#loadAccount(token, signedInEmail)
  }

  async #authorized(path: string, init: RequestInit = {}): Promise<AccountResult<unknown>> {
    const stored = await accountItem.getValue()
    if (!stored?.token) return { error: 'signed-out', ok: false }
    return this.#request(path, { ...init, token: stored.token })
  }

  async #consentGuard(): Promise<AccountResult> {
    if (await signInConsented()) return { ok: true, value: undefined }
    const stored = await accountItem.getValue()
    if (stored?.token) await accountItem.setValue({ email: stored.email, staleToken: stored.token })
    this.#setState({ notice: 'paused-no-consent', status: 'signed-out' })
    return { error: 'consent-refused', ok: false }
  }

  async #loadAccount(token: string, email: string): Promise<AccountResult> {
    const result = await this.#request('/v1/me', { token })
    if (!result.ok) return result
    if (typeof result.value !== 'object' || result.value === null) {
      return { error: 'invalid-response', ok: false }
    }
    const me = result.value as { email?: unknown; pending?: unknown }
    if (typeof me.pending !== 'boolean') return { error: 'invalid-response', ok: false }
    const actualEmail = typeof me.email === 'string' ? me.email : email
    if (me.pending) {
      const listed = await this.#request('/v1/devices', { token })
      if (!listed.ok) return listed
      if (typeof listed.value !== 'object' || listed.value === null) {
        return { error: 'invalid-response', ok: false }
      }
      const devices = (listed.value as { devices?: unknown }).devices
      if (!Array.isArray(devices)) return { error: 'invalid-response', ok: false }
      this.#setState({
        devices: devices as Device[],
        email: actualEmail,
        notice: 'none',
        status: 'pending-device',
      })
    } else {
      this.#setState({ email: actualEmail, notice: 'none', status: 'signed-in' })
    }
    return { ok: true, value: undefined }
  }

  async #refresh(): Promise<void> {
    const stored = await accountItem.getValue()
    if (!(await signInConsented())) {
      if (stored?.token) {
        await accountItem.setValue({ email: stored.email, staleToken: stored.token })
      }
      this.#setState({ notice: 'paused-no-consent', status: 'signed-out' })
      return
    }
    if (!stored?.token) {
      this.#setState(signedOut())
      return
    }
    await this.#loadAccount(stored.token, stored.email)
  }

  async #request(
    path: string,
    options: RequestInit & { token?: string } = {},
  ): Promise<RequestResult> {
    const { token, ...init } = options
    const headers = new Headers(init.headers)
    if (init.body) headers.set('content-type', 'application/json')
    if (token) headers.set('authorization', `Bearer ${token}`)
    try {
      const response = await fetch(`${config.serverUrl}${path}`, {
        ...init,
        credentials: 'omit',
        headers,
      })
      if (response.status === 401) {
        await accountItem.setValue(null)
        this.#setState({ notice: 'signed-out-elsewhere', status: 'signed-out' })
        return { error: 'signed-out', ok: false }
      }
      if (response.status === 429) return { error: 'too-many-tries', ok: false }
      if (!response.ok && response.status !== 204) {
        return {
          error:
            response.status === 400 && path === '/api/auth/sign-in/email-otp'
              ? 'wrong-code'
              : 'http-error',
          ok: false,
        }
      }
      if (response.status === 204) return { ok: true, response, value: undefined }
      let value: unknown
      try {
        value = await response.json()
      } catch {
        value = undefined
      }
      return { ok: true, response, value }
    } catch {
      return { error: 'network-error', ok: false }
    }
  }

  #setState(state: AccountState): void {
    this.#state = state
    for (const listener of this.#listeners) listener(state)
  }

  #visibilityHandler = () => {
    if (document.visibilityState === 'visible') void this.#refresh()
  }
}

export const account = new AccountClient()

/** Subscribe a Preact component to the current account state. */
export function useAccount(): AccountState {
  const [state, setState] = useState(account.state)
  useEffect(() => {
    void account.initialize()
    return account.subscribe(setState)
  }, [])
  return state
}
