import { useEffect, useRef, useState } from 'preact/hooks'

import { syncClient, useSyncStatus } from '@/sync/client'
import { FirstSignInChoice } from '@/sync/FirstSignInChoice'

import { account, useAccount } from './account'
import type { AccountState } from './account'
import { ACCOUNT_DATA_DISCLOSURE } from './copy'

const POLICY_URL = 'https://github.com/logankuzyk/lander-ntp/blob/main/PRIVACY.md'

const ERROR_COPY: Record<string, string> = {
  'consent-refused': 'Lander needs your OK to send your email and settings.',
  'http-error': 'Couldn’t complete that request. Try again.',
  'network-error': 'Couldn’t connect. Check your connection and try again.',
  'signed-out': 'You’ve been signed out. Request a new code to sign in.',
  'too-many-tries': 'Too many tries. Wait a little while, then try again.',
  'wrong-code': 'That code is wrong or has expired. Check it and try again.',
}

type AccountSectionProps = {
  codeSentInitially?: boolean
  deleteOpenInitially?: boolean
  errorInitially?: string
  stateOverride?: AccountState
}

export function AccountSection({
  codeSentInitially = false,
  deleteOpenInitially = false,
  errorInitially = '',
  stateOverride,
}: AccountSectionProps = {}) {
  const currentState = useAccount()
  const state = stateOverride ?? currentState
  const signedInEmail = state.status === 'signed-in' ? state.email : null
  const syncStatus = useSyncStatus()
  const [email, setEmail] = useState('')
  const latestEmail = useRef('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(codeSentInitially)
  const [error, setError] = useState(ERROR_COPY[errorInitially] ?? errorInitially)
  const [devices, setDevices] = useState(state.status === 'signed-in' ? (state.devices ?? []) : [])
  const [deleteOpen, setDeleteOpen] = useState(deleteOpenInitially)
  const [deleted, setDeleted] = useState(false)

  useEffect(() => {
    if (stateOverride) return
    if (state.status === 'signed-in') void syncClient.initialize()
    else syncClient.reset()
  }, [signedInEmail, state.status, stateOverride])

  useEffect(() => {
    if (state.status === 'pending-device') setDevices(state.devices)
    if (state.status === 'signed-in' && state.devices) setDevices(state.devices)
    if (state.status === 'signed-in' && !state.devices) {
      void account.devices().then((result) => {
        if (result.ok) setDevices(result.value)
        else setError(ERROR_COPY[result.error] ?? 'Couldn’t load devices. Try again.')
      })
    }
  }, [state])

  const sendCode = async (event: Event) => {
    event.preventDefault()
    setError('')
    const form = event.currentTarget as HTMLFormElement
    const submittedEmail = form.querySelector<HTMLInputElement>('input[type="email"]')?.value
    if (submittedEmail !== undefined) {
      latestEmail.current = submittedEmail
      setEmail(submittedEmail)
    }
    const result = await account.sendCode((submittedEmail ?? latestEmail.current).trim())
    if (result.ok) setCodeSent(true)
    else setError(ERROR_COPY[result.error] ?? 'Couldn’t send a code. Try again.')
  }

  const signIn = async (event: Event) => {
    event.preventDefault()
    setError('')
    const result = await account.verify(latestEmail.current.trim(), code)
    if (!result.ok) setError(ERROR_COPY[result.error] ?? 'Couldn’t sign in. Try again.')
  }

  const resendCode = async () => {
    setError('')
    const result = await account.sendCode(latestEmail.current.trim())
    if (result.ok) setCode('')
    else setError(ERROR_COPY[result.error] ?? 'Couldn’t send a code. Try again.')
  }

  const signOut = async () => {
    setError('')
    const result = await account.signOut()
    if (!result.ok) setError(ERROR_COPY[result.error] ?? 'Couldn’t sign out. Try again.')
  }

  const signOutDevice = async (deviceId: string) => {
    setError('')
    const result = await account.removeDevice(deviceId)
    if (!result.ok)
      setError(ERROR_COPY[result.error] ?? 'Couldn’t sign out that device. Try again.')
    else setDevices((current) => current.filter((device) => device.id !== deviceId))
  }

  const cancelPending = async () => {
    setError('')
    const result = await account.signOut()
    if (!result.ok) setError(ERROR_COPY[result.error] ?? 'Couldn’t cancel. Try again.')
  }

  const deleteAccount = async () => {
    setError('')
    const result = await account.deleteAccount()
    if (result.ok) {
      setDeleteOpen(false)
      setDeleted(true)
    } else {
      setError(ERROR_COPY[result.error] ?? 'Couldn’t delete the account. Try again.')
    }
  }

  return (
    <section aria-label="Account" class="account-settings">
      {state.status === 'signed-in' || state.status === 'pending-device' ? (
        <>
          <p>{state.email}</p>
          {state.status === 'pending-device' ? (
            <>
              <p>Choose a device to sign out so this one can sync</p>
              <DeviceList devices={devices} hideCurrent onSignOut={signOutDevice} />
              <button class="settings__button" onClick={cancelPending} type="button">
                Cancel
              </button>
              <button class="settings__link" onClick={() => setDeleteOpen(true)} type="button">
                Delete account
              </button>
            </>
          ) : (
            <>
              {syncStatus.needsChoice ? (
                <p role="status">Sync is paused until you choose a page.</p>
              ) : (
                <p>
                  {syncStatus.syncing ? 'Syncing…' : syncStatus.ready ? 'Synced' : 'Not synced yet'}
                </p>
              )}
              {syncStatus.needsChoice && (
                <FirstSignInChoice
                  choose={(choice) => void syncClient.choose(choice)}
                  syncStatus={syncStatus}
                />
              )}
              <p>Up to 3 devices</p>
              <DeviceList devices={devices} onSignOut={signOutDevice} />
              <button class="settings__button" onClick={signOut} type="button">
                Sign out
              </button>
              <button class="settings__link" onClick={() => setDeleteOpen(true)} type="button">
                Delete account
              </button>
            </>
          )}
        </>
      ) : (
        <>
          {state.notice === 'signed-out-elsewhere' && (
            <p role="status">Signed out on another device</p>
          )}
          {state.notice === 'paused-no-consent' && (
            <p role="status">
              Sync is paused: Lander needs your OK to send your email and settings
            </p>
          )}
          {!codeSent ? (
            <form onSubmit={sendCode}>
              <p>
                {ACCOUNT_DATA_DISCLOSURE}{' '}
                <a href={POLICY_URL} rel="noreferrer" target="_blank">
                  Privacy policy
                </a>
              </p>
              <label class="settings__row">
                <span>Email</span>
                <input
                  autoComplete="email"
                  name="email"
                  onInput={(event) => {
                    latestEmail.current = event.currentTarget.value
                    setEmail(latestEmail.current)
                  }}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <button class="settings__button" type="submit">
                Send code
              </button>
            </form>
          ) : (
            <form onSubmit={signIn}>
              <p>Enter the six-digit code sent to {email.trim()}.</p>
              <label class="settings__row">
                <span>Code</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  onInput={(event) => setCode(event.currentTarget.value)}
                  pattern="[0-9]{6}"
                  required
                  value={code}
                />
              </label>
              <button class="settings__button" type="submit">
                Sign in
              </button>
              <button
                class="settings__link"
                onClick={() => {
                  setCodeSent(false)
                  setCode('')
                  setError('')
                }}
                type="button"
              >
                Change email
              </button>
              <button class="settings__link" onClick={resendCode} type="button">
                Send a new code
              </button>
            </form>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {deleted && <p role="status">Your account has been deleted.</p>}
      {deleteOpen && (
        <dialog aria-labelledby="delete-account-title" open>
          <h2 id="delete-account-title">Delete account</h2>
          <p>This removes the server’s copy of your email, settings and device list.</p>
          <p>Your page and browser sync stay on every device.</p>
          <button class="settings__button" onClick={deleteAccount} type="button">
            Confirm delete account
          </button>
          <button class="settings__link" onClick={() => setDeleteOpen(false)} type="button">
            Cancel
          </button>
        </dialog>
      )}
    </section>
  )
}

function DeviceList({
  devices,
  hideCurrent = false,
  onSignOut,
}: {
  devices: import('./account').Device[]
  hideCurrent?: boolean
  onSignOut: (id: string) => void
}) {
  return (
    <ul class="account-devices">
      {devices
        .filter((device) => !(hideCurrent && device.current))
        .map((device) => (
          <li key={device.id}>
            <span>
              {device.browser} on {device.os}, {timeAgo(device.lastUsedAt)}
            </span>
            {device.current && <span>This device</span>}
            <button class="settings__link" onClick={() => onSignOut(device.id)} type="button">
              Sign out
            </button>
          </li>
        ))}
    </ul>
  )
}

function timeAgo(value: string): string {
  const elapsedDays = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86_400_000))
  if (elapsedDays < 1) return 'today'
  if (elapsedDays < 7) return `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} ago`
  const weeks = Math.floor(elapsedDays / 7)
  if (weeks < 5) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  const months = Math.floor(elapsedDays / 30)
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`
  const years = Math.floor(elapsedDays / 365)
  return `${years} ${years === 1 ? 'year' : 'years'} ago`
}
