import { useEffect, useState } from 'preact/hooks'
import { storage } from 'wxt/utils/storage'

import config from '@/account/config'
import { signInConsented } from '@/account/consent'
import { type Onboarding, onboardingItem } from '@/onboarding/storage'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'

import { canon, mergeOnboarding, planFirstSignIn } from './planning'
import { syncedShapes } from './shapes'

type StoredAccount = { email: string; token?: string }
type SyncValues = Record<string, unknown>
type SyncChoiceRecord =
  | { email: string; state: 'complete'; v: 1 }
  | {
      email: string
      local: SyncValues
      remote: SyncValues
      rev: number
      state: 'needs-choice'
      v: 1
    }

export type SyncStatus = { needsChoice: boolean; ready: boolean; syncing: boolean }

const accountItem = storage.defineItem<StoredAccount | null>('local:account', { fallback: null })
const choiceItem = storage.defineItem<SyncChoiceRecord | null>('local:sync-choice', {
  fallback: null,
})
const idle: SyncStatus = { needsChoice: false, ready: false, syncing: false }
const record = (value: unknown): SyncValues =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as SyncValues) : {}
const settingsContent = (value: unknown): Settings => {
  const settings = { ...record(value) }
  delete settings.v
  return settings as Settings
}
const versionedSettings = (value: unknown): Settings & { v: number } => ({
  ...settingsContent(value),
  v: syncedShapes.settings.version,
})
const onboardingContent = (value: unknown): Onboarding | undefined => {
  const item = record(value)
  return Array.isArray(item.dismissed) && typeof item.welcomed === 'boolean'
    ? (item as Onboarding)
    : undefined
}
const versionedOnboarding = (value: unknown): Onboarding & { v: number } => ({
  ...record(value),
  dismissed: onboardingContent(value)?.dismissed ?? [],
  v: syncedShapes.onboarding.version,
  welcomed: onboardingContent(value)?.welcomed ?? false,
})
const itemValue = (items: SyncValues, key: string): unknown => record(items[key]).value

class SyncClient {
  get status(): SyncStatus {
    return this.#status
  }
  #listeners = new Set<(status: SyncStatus) => void>()
  #running: Promise<void> | null = null

  #status = idle

  async choose(choice: 'account' | 'browser'): Promise<void> {
    const question = await choiceItem.getValue()
    if (!question || question.state !== 'needs-choice') return
    const stored = await accountItem.getValue()
    if (!stored?.token || stored.email !== question.email || !(await signInConsented())) return

    this.#setStatus({ needsChoice: true, ready: false, syncing: true })
    const selected = choice === 'account' ? question.remote : question.local
    const selectedSettings = selected.settings ?? DEFAULT_SETTINGS
    const onboarding = mergeOnboarding(question.local.onboarding, question.remote.onboarding)

    if (choice === 'browser') {
      const saved = await this.#put(stored.token, 'settings', versionedSettings(selectedSettings))
      if (!saved) return this.#pause()
    }
    if (canon(onboarding) !== canon(question.remote.onboarding)) {
      const saved = await this.#put(stored.token, 'onboarding', {
        ...onboarding,
        v: syncedShapes.onboarding.version,
      })
      if (!saved) return this.#pause()
    }

    await settingsItem.setValue(versionedSettings(selectedSettings))
    await onboardingItem.setValue(versionedOnboarding(onboarding))
    await choiceItem.setValue({ email: stored.email, state: 'complete', v: 1 })
    this.#setStatus({ needsChoice: false, ready: true, syncing: false })
  }

  async initialize(): Promise<void> {
    if (this.#running) return this.#running
    this.#running = this.#initialize()
    try {
      await this.#running
    } finally {
      this.#running = null
    }
  }

  reset(): void {
    this.#setStatus(idle)
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #finish(): void {
    this.#setStatus(idle)
  }

  async #initialize(): Promise<void> {
    const stored = await accountItem.getValue()
    if (!stored?.token || !(await signInConsented())) return

    const previous = await choiceItem.getValue()
    if (previous?.email === stored.email && previous.state === 'needs-choice') {
      this.#setStatus({ needsChoice: true, ready: false, syncing: false })
      return
    }
    if (previous?.email === stored.email && previous.state === 'complete') {
      this.#setStatus({ needsChoice: false, ready: true, syncing: false })
      return
    }
    this.#setStatus({ needsChoice: false, ready: false, syncing: true })
    const response = await this.#request(stored.token, '/v1/sync')
    if (!response.ok) return this.#finish()
    let snapshot: SyncValues
    try {
      snapshot = record(await response.json())
    } catch {
      return this.#finish()
    }
    const remoteItems = record(snapshot.items)
    const local: SyncValues = { settings: settingsContent(await settingsItem.getValue()) }
    const localOnboarding = onboardingContent(await onboardingItem.getValue())
    if (localOnboarding) local.onboarding = localOnboarding

    const remote: SyncValues = {}
    for (const key of ['layout', 'settings', 'onboarding']) {
      const value = itemValue(remoteItems, key)
      if (value !== undefined) remote[key] = key === 'settings' ? settingsContent(value) : value
    }

    const action = planFirstSignIn(local, remote)
    if (action === 'ask') {
      await choiceItem.setValue({
        email: stored.email,
        local,
        remote,
        rev: typeof snapshot.rev === 'number' ? snapshot.rev : 0,
        state: 'needs-choice',
        v: 1,
      })
      this.#setStatus({ needsChoice: true, ready: false, syncing: false })
      return
    }
    if (action === 'download' && remote.settings) {
      await settingsItem.setValue(versionedSettings(remote.settings))
    } else if (action === 'upload') {
      const saved = await this.#put(stored.token, 'settings', versionedSettings(local.settings))
      if (!saved) return this.#finish()
    }
    await this.#mergeOnboarding(stored.token, local.onboarding, remote.onboarding)
    await choiceItem.setValue({ email: stored.email, state: 'complete', v: 1 })
    this.#setStatus({ needsChoice: false, ready: true, syncing: false })
  }

  async #mergeOnboarding(token: string, local: unknown, remote: unknown): Promise<void> {
    const merged = mergeOnboarding(local, remote)
    if (canon(merged) !== canon(remote)) {
      await this.#put(token, 'onboarding', { ...merged, v: syncedShapes.onboarding.version })
    }
    await onboardingItem.setValue(versionedOnboarding(merged))
  }

  #pause(): void {
    this.#setStatus({ needsChoice: true, ready: false, syncing: false })
  }

  async #put(token: string, item: string, value: unknown): Promise<boolean> {
    const response = await this.#request(token, `/v1/sync/${item}`, {
      body: JSON.stringify({ value }),
      headers: { 'content-type': 'application/json' },
      method: 'PUT',
    })
    return response.ok
  }

  async #request(token: string, path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetch(`${config.serverUrl}${path}`, {
        ...init,
        credentials: 'omit',
        headers: {
          ...Object.fromEntries(new Headers(init.headers)),
          authorization: `Bearer ${token}`,
        },
      })
    } catch {
      return new Response(null, { status: 503 })
    }
  }

  #setStatus(status: SyncStatus): void {
    this.#status = status
    for (const listener of this.#listeners) listener(status)
  }
}

export const syncClient = new SyncClient()

/** Subscribe the Account section to first-sign-in sync state. */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState(syncClient.status)
  useEffect(() => syncClient.subscribe(setStatus), [])
  return status
}
