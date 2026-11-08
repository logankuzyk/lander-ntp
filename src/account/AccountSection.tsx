import { useState } from 'preact/hooks'

import { account, useAccount } from './account'
import type { AccountState } from './account'
import { ACCOUNT_DATA_DISCLOSURE } from './copy'

const POLICY_URL = 'https://github.com/logankuzyk/lander-ntp/blob/main/PRIVACY.md'

const ERROR_COPY: Record<string, string> = {
  'consent-refused': 'Lander needs your OK to send your email and settings.',
  'network-error': 'Couldn’t connect. Check your connection and try again.',
  'signed-out': 'You’ve been signed out. Request a new code to sign in.',
  'too-many-tries': 'Too many tries. Wait a little while, then try again.',
  'wrong-code': 'That code is wrong or has expired. Check it and try again.',
}

type AccountSectionProps = {
  codeSentInitially?: boolean
  errorInitially?: string
  stateOverride?: AccountState
}

export function AccountSection({
  codeSentInitially = false,
  errorInitially = '',
  stateOverride,
}: AccountSectionProps = {}) {
  const currentState = useAccount()
  const state = stateOverride ?? currentState
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(codeSentInitially)
  const [error, setError] = useState(ERROR_COPY[errorInitially] ?? errorInitially)

  const sendCode = async (event: Event) => {
    event.preventDefault()
    setError('')
    const result = await account.sendCode(email.trim())
    if (result.ok) setCodeSent(true)
    else setError(ERROR_COPY[result.error] ?? 'Couldn’t send a code. Try again.')
  }

  const signIn = async (event: Event) => {
    event.preventDefault()
    setError('')
    const result = await account.verify(email.trim(), code)
    if (!result.ok) setError(ERROR_COPY[result.error] ?? 'Couldn’t sign in. Try again.')
  }

  const signOut = async () => {
    setError('')
    const result = await account.signOut()
    if (!result.ok) setError(ERROR_COPY[result.error] ?? 'Couldn’t sign out. Try again.')
  }

  return (
    <section aria-label="Account" class="account-settings">
      {state.status === 'signed-in' || state.status === 'pending-device' ? (
        <>
          <p>{state.email}</p>
          <p>Not synced yet</p>
          <button class="settings__button" onClick={signOut} type="button">
            Sign out
          </button>
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
                  onInput={(event) => setEmail(event.currentTarget.value)}
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
            </form>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
