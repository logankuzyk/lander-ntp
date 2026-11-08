import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'

import { account } from '@/account/account'
import type { SettingsStop } from '@/onboarding/callouts'
import type { PhotoSettings } from '@/photos/rotation'
import type { Photo } from '@/photos/schema'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { syncClient } from '@/sync/client'
import { makePhoto } from '@/test/fixtures'

import { SettingsPanel } from './SettingsPanel'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  clock: { enabled: true, hour12: true, showDate: false, showSeconds: false },
  photos: { frequency: '1h', mode: 'cycle', pinnedId: null, tags: [] },
  weather: { ...DEFAULT_SETTINGS.weather, unit: 'celsius' },
}

const PHOTOS = [
  makePhoto('a', { alt: 'Waterfall', tags: [{ name: 'Water', slug: 'water' }] }),
  makePhoto('b', { alt: 'Tide pools', tags: [{ name: 'Beach', slug: 'beach' }] }),
]

const renderPanel = ({
  accountPreview,
  initialSection,
  overrides = {},
  photos = PHOTOS,
}: {
  accountPreview?: NonNullable<Parameters<typeof SettingsPanel>[0]['accountPreview']>
  initialSection?: Parameters<typeof SettingsPanel>[0]['initialSection']
  overrides?: Partial<Settings>
  photos?: Photo[]
} = {}) => {
  const onChange = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <SettingsPanel
      accountPreview={accountPreview}
      currentId="a"
      initialSection={initialSection}
      onChange={onChange}
      onClose={onClose}
      photos={photos}
      settings={{ ...settings, ...overrides }}
    />,
  )
  return { ...view, onChange, onClose }
}

const withPhotos = (changes: Partial<PhotoSettings>): Settings => ({
  ...settings,
  photos: { ...settings.photos, ...changes },
})

const openSection = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' }, status })

describe('SettingsPanel', () => {
  beforeEach(async () => {
    syncClient.reset()
    // fakeBrowser.reset() clears storage but the account client keeps its in-memory state.
    // Refresh it before rendering so a prior sign-in cannot mask the email/code form.
    await browser.storage.local.clear()
    await account.initialize()
  })

  it('opens as a labelled popover with the close button focused', () => {
    renderPanel()

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close settings' }))
  })

  it('closes with the button, with Escape and with a click outside', () => {
    const { onClose } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.pointerDown(document.body)

    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('stays open for clicks inside it', () => {
    const { onClose } = renderPanel()

    fireEvent.pointerDown(screen.getByRole('tab', { name: 'General' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Tide pools' }))

    expect(onClose).not.toHaveBeenCalled()
  })

  describe('sections', () => {
    it('lists photos, account and general settings, starting on photos', () => {
      renderPanel()
      const tabs = screen.getAllByRole('tab')
      expect(tabs.map((tab) => tab.textContent)).toEqual(['Photos', 'Account', 'General'])
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Photos')
      expect(screen.getByRole('tabpanel', { name: 'Photos' })).toBeTruthy()
    })
  })

  it('switches section from the sidebar', () => {
    renderPanel()

    openSection('General')
    expect(screen.getByRole('tabpanel', { name: 'General' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Font' })).toBeTruthy()
    expect(screen.queryByLabelText('Change photo')).toBeNull()
  })

  describe('account', () => {
    beforeEach(() => {
      vi.stubEnv('BROWSER', 'firefox')
      vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true as never)
      vi.spyOn(browser.permissions, 'request').mockResolvedValue(true as never)
    })
    afterEach(() => vi.unstubAllEnvs())

    const openAccount = () => {
      const panel = renderPanel()
      openSection('Account')
      return panel
    }
    const signInWithSnapshot = async (
      localSettings: Settings,
      remoteSettings: Settings,
      remoteLayout?: unknown,
    ) => {
      await settingsItem.setValue(localSettings)
      const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
        const path = new URL(String(input)).pathname
        if (path.endsWith('/email-otp/send-verification-otp')) {
          return jsonResponse({ success: true })
        }
        if (path.endsWith('/sign-in/email-otp')) {
          return jsonResponse({ token: 'token', user: { email: 'person@example.com' } })
        }
        if (path === '/v1/me') {
          return jsonResponse({ email: 'person@example.com', pending: false })
        }
        if (path === '/v1/devices') {
          return jsonResponse({ devices: [], limit: 3, pending: false })
        }
        if (path === '/v1/sync') {
          const items: Record<string, unknown> = {
            settings: { v: 1, value: { ...remoteSettings, v: 1 } },
          }
          if (remoteLayout !== undefined) items.layout = { v: 1, value: remoteLayout }
          return jsonResponse({
            items,
            rev: 1,
          })
        }
        return jsonResponse({ changed: true, rev: 2 })
      })
      vi.stubGlobal('fetch', fetch)
      const panel = openAccount()
      fireEvent.input(screen.getByLabelText('Email'), {
        target: { value: 'person@example.com' },
      })
      fireEvent.submit(
        screen.getByRole('button', { name: 'Send code' }).closest('form') as HTMLFormElement,
      )
      const code = await screen.findByLabelText('Code')
      fireEvent.input(code, { target: { value: '123456' } })
      fireEvent.submit(
        screen.getByRole('button', { name: 'Sign in' }).closest('form') as HTMLFormElement,
      )
      return { fetch, panel }
    }

    it('shows the disclosure and policy before sending a code, then asks for the six-digit code', async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(jsonResponse({ success: true }))
      vi.stubGlobal('fetch', fetch)
      openAccount()

      const disclosure = screen.getByText(/your email address.*OVH behind Cloudflare.*Resend/i)
      const policy = screen.getByRole('link', { name: 'Privacy policy' })
      expect(
        disclosure.compareDocumentPosition(policy) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(policy.getAttribute('href')).toContain('PRIVACY.md')
      fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send code' }))

      expect(await screen.findByLabelText('Code')).toBeTruthy()
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('shows a plain error for a wrong or expired code', async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(jsonResponse({ success: true }))
        .mockResolvedValueOnce(jsonResponse({ message: 'invalid otp' }, 400))
      vi.stubGlobal('fetch', fetch)
      openAccount()
      fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
      const code = await screen.findByLabelText('Code')
      fireEvent.input(code, { target: { value: '123456' } })
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

      expect((await screen.findByRole('alert')).textContent).toContain('wrong or has expired')
    })

    it('can request a fresh code or change the email after the code step starts', async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(async () => jsonResponse({ success: true }))
      vi.stubGlobal('fetch', fetch)
      openAccount()
      fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
      fireEvent.submit(
        screen.getByRole('button', { name: 'Send code' }).closest('form') as HTMLFormElement,
      )
      await screen.findByLabelText('Code')

      fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
      expect(fetch.mock.calls[1]?.[1]?.body).toBe(
        JSON.stringify({ email: 'person@example.com', type: 'sign-in' }),
      )

      fireEvent.click(screen.getByRole('button', { name: 'Change email' }))
      const email = screen.getByLabelText('Email') as HTMLInputElement
      expect(email.value).toBe('person@example.com')
      fireEvent.input(email, { target: { value: 'other@example.com' } })
      fireEvent.submit(
        screen.getByRole('button', { name: 'Send code' }).closest('form') as HTMLFormElement,
      )
      await screen.findByLabelText('Code')
      expect(fetch.mock.calls[2]?.[1]?.body).toBe(
        JSON.stringify({ email: 'other@example.com', type: 'sign-in' }),
      )
    })

    it('sends a trimmed email address for both code requests and verification', async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(jsonResponse({ success: true }))
        .mockResolvedValueOnce(
          jsonResponse({ token: 'token', user: { email: 'person@example.com' } }),
        )
        .mockResolvedValueOnce(jsonResponse({ email: 'person@example.com', pending: false }))
      vi.stubGlobal('fetch', fetch)
      openAccount()
      fireEvent.input(screen.getByLabelText('Email'), {
        target: { value: ' person@example.com ' },
      })
      fireEvent.submit(
        screen.getByRole('button', { name: 'Send code' }).closest('form') as HTMLFormElement,
      )
      const code = await screen.findByLabelText('Code')
      expect(fetch.mock.calls[0]?.[1]?.body).toBe(
        JSON.stringify({ email: 'person@example.com', type: 'sign-in' }),
      )

      fireEvent.input(code, { target: { value: '123456' } })
      fireEvent.submit(
        screen.getByRole('button', { name: 'Sign in' }).closest('form') as HTMLFormElement,
      )
      await screen.findByText('person@example.com')
      expect(fetch.mock.calls[1]?.[1]?.body).toBe(
        JSON.stringify({ email: 'person@example.com', otp: '123456' }),
      )
    })

    it('shows the signed-in account while a device is pending', () => {
      renderPanel({
        accountPreview: {
          state: {
            devices: [],
            email: 'person@example.com',
            notice: 'none',
            status: 'pending-device',
          },
        },
        initialSection: 'account',
      })

      expect(screen.getByText('person@example.com')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    })

    it('shows the signed-out-elsewhere notice distinctly from the paused notice', () => {
      renderPanel({
        accountPreview: {
          state: { notice: 'signed-out-elsewhere', status: 'signed-out' },
        },
        initialSection: 'account',
      })

      expect(screen.getByRole('status').textContent).toBe('Signed out on another device')
    })

    it('shows too many tries in plain words', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse({}, 429)),
      )
      openAccount()
      fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send code' }))

      expect((await screen.findByRole('alert')).textContent).toContain('Too many tries')
    })

    it('explains when the connection is unavailable', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('offline')),
      )
      openAccount()
      fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send code' }))

      expect((await screen.findByRole('alert')).textContent).toContain('Check your connection')
    })

    it('explains when consent is refused', async () => {
      vi.spyOn(browser.permissions, 'contains').mockResolvedValue(false as never)
      vi.spyOn(browser.permissions, 'request').mockResolvedValue(false as never)
      const fetch = vi.fn<typeof globalThis.fetch>()
      vi.stubGlobal('fetch', fetch)
      openAccount()
      fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send code' }))

      expect((await screen.findByRole('alert')).textContent).toContain('Lander needs your OK')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('shows the signed-in address and signs out through the account client', async () => {
      const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
        const path = new URL(String(input)).pathname
        if (path.endsWith('/sign-in/email-otp')) {
          return jsonResponse({ token: 'token', user: { email: 'person@example.com' } })
        }
        if (path === '/v1/me') {
          return jsonResponse({ email: 'person@example.com', pending: false })
        }
        if (path === '/v1/devices') {
          return jsonResponse({ devices: [], limit: 3, pending: false })
        }
        if (path === '/v1/sync') return jsonResponse({ items: {}, rev: 0 })
        if (path === '/api/auth/sign-out') return new Response(null, { status: 204 })
        return jsonResponse({ changed: true, rev: 1 })
      })
      vi.stubGlobal('fetch', fetch)
      await account.verify('person@example.com', '123456')
      openAccount()

      expect(await screen.findByText('person@example.com')).toBeTruthy()
      await screen.findByText('Synced')
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
      await waitFor(() => expect(screen.queryByText('person@example.com')).toBeNull())
      expect(fetch).toHaveBeenCalledTimes(8)
    })

    it('shows the first-sign-in choice without writing either side until picked', async () => {
      const localSettings = { ...settings, dim: false, v: 1 } as Settings
      const { fetch, panel } = await signInWithSnapshot(localSettings, {
        ...settings,
        font: 'geist',
      })

      expect(await screen.findByRole('region', { name: 'Choose which page to keep' })).toBeTruthy()
      expect(await settingsItem.getValue()).toEqual(localSettings)
      expect(screen.getByText('Sync is paused until you choose a page.')).toBeTruthy()
      expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
      expect(panel.onClose).toHaveBeenCalledOnce()
      expect(await settingsItem.getValue()).toEqual(localSettings)
      expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
      panel.unmount()
      syncClient.reset()
      openAccount()
      expect(await screen.findByRole('region', { name: 'Choose which page to keep' })).toBeTruthy()
      expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/v1/sync'))).toHaveLength(1)
    })

    it('asks nothing when first sign-in finds identical Settings', async () => {
      const sameSettings = { ...settings, dim: false, v: 1 } as Settings
      const { fetch } = await signInWithSnapshot(sameSettings, sameSettings)

      await waitFor(() => expect(screen.getByText('Synced')).toBeTruthy())
      expect(screen.queryByRole('region', { name: 'Choose which page to keep' })).toBeNull()
      expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/v1/sync'))).toHaveLength(1)
      expect(await settingsItem.getValue()).toEqual(sameSettings)
    })

    it('applies the selected copy only after the user chooses it', async () => {
      const localSettings = { ...settings, dim: false, v: 1 } as Settings
      const remoteSettings: Settings = { ...settings, font: 'geist' }
      const { fetch } = await signInWithSnapshot(localSettings, remoteSettings)
      await screen.findByRole('region', { name: 'Choose which page to keep' })

      fireEvent.click(screen.getByRole('button', { name: "Use your account's page" }))

      await screen.findByText('Synced')
      expect(await settingsItem.getValue()).toEqual({ ...remoteSettings, v: 1 })
      expect(
        fetch.mock.calls.some(
          ([url, init]) => String(url).endsWith('/v1/sync/settings') && init?.method === 'PUT',
        ),
      ).toBe(false)
    })

    it('uploads this browser’s Settings only after that choice is picked', async () => {
      const localSettings = { ...settings, dim: false, v: 1 } as Settings
      const { fetch } = await signInWithSnapshot(localSettings, { ...settings, font: 'geist' })
      await screen.findByRole('region', { name: 'Choose which page to keep' })

      fireEvent.click(screen.getByRole('button', { name: "Keep this browser's" }))

      await screen.findByText('Synced')
      expect(
        fetch.mock.calls.some(
          ([url, init]) => String(url).endsWith('/v1/sync/settings') && init?.method === 'PUT',
        ),
      ).toBe(true)
      expect(await settingsItem.getValue()).toEqual(localSettings)
    })

    it('keeps both Layouts untouched until the first-sign-in choice is picked', async () => {
      const localLayout = { v: 1, widgets: ['clock', 'weather'] }
      const accountLayout = { v: 1, widgets: ['photos'] }
      await browser.storage.sync.set({ layout: localLayout })
      await signInWithSnapshot(settings, settings, accountLayout)

      await screen.findByRole('region', { name: 'Choose which page to keep' })
      expect((await browser.storage.sync.get('layout')).layout).toEqual(localLayout)

      fireEvent.click(screen.getByRole('button', { name: "Use your account's page" }))

      await screen.findByText('Synced')
      expect((await browser.storage.sync.get('layout')).layout).toEqual(accountLayout)
    })
  })

  it('moves between sections with the arrow keys', () => {
    renderPanel()
    const photos = screen.getByRole('tab', { name: 'Photos' })

    fireEvent.keyDown(photos, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Account' }))
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Account')

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' })
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Photos')

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' })
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('General')

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' })
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Photos')
  })

  it('has no favourites', () => {
    renderPanel()

    expect(screen.queryByRole('tab', { name: 'Favourites' })).toBeNull()
    expect(screen.queryByText(/favourite/i)).toBeNull()
  })
})

describe('account', () => {
  const openAccount = () => {
    renderPanel()
    openSection('Account')
  }

  beforeEach(async () => {
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true as never)
    vi.spyOn(browser.permissions, 'request').mockResolvedValue(true as never)
    await browser.storage.local.clear()
    await account.initialize()
  })

  it('shows the disclosure and policy before sending a code, then asks for the six-digit code', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal('fetch', fetch)
    openAccount()

    const disclosure = screen.getByText(/your email address.*OVH behind Cloudflare.*Resend/i)
    const policy = screen.getByRole('link', { name: 'Privacy policy' })
    expect(
      disclosure.compareDocumentPosition(policy) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(policy.getAttribute('href')).toContain('PRIVACY.md')
    fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))

    expect(await screen.findByLabelText('Code')).toBeTruthy()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('shows a plain error for a wrong or expired code', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ message: 'invalid otp' }, 400))
    vi.stubGlobal('fetch', fetch)
    openAccount()
    fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    const code = await screen.findByLabelText('Code')
    fireEvent.input(code, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect((await screen.findByRole('alert')).textContent).toContain('wrong or has expired')
  })

  it('can request a fresh code or change the email after the code step starts', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(async () => jsonResponse({ success: true }))
    vi.stubGlobal('fetch', fetch)
    openAccount()
    fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Send code' }).closest('form') as HTMLFormElement,
    )
    await screen.findByLabelText('Code')

    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ email: 'person@example.com', type: 'sign-in' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Change email' }))
    const email = screen.getByLabelText('Email') as HTMLInputElement
    expect(email.value).toBe('person@example.com')
    fireEvent.input(email, { target: { value: 'other@example.com' } })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Send code' }).closest('form') as HTMLFormElement,
    )
    await screen.findByLabelText('Code')
    expect(fetch.mock.calls[2]?.[1]?.body).toBe(
      JSON.stringify({ email: 'other@example.com', type: 'sign-in' }),
    )
  })

  it('sends a trimmed email address for both code requests and verification', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(
        jsonResponse({ token: 'token', user: { email: 'person@example.com' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ email: 'person@example.com', pending: false }))
    vi.stubGlobal('fetch', fetch)
    openAccount()
    fireEvent.input(screen.getByLabelText('Email'), {
      target: { value: ' person@example.com ' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Send code' }).closest('form') as HTMLFormElement,
    )
    const code = await screen.findByLabelText('Code')
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ email: 'person@example.com', type: 'sign-in' }),
    )

    fireEvent.input(code, { target: { value: '123456' } })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Sign in' }).closest('form') as HTMLFormElement,
    )
    await screen.findByText('person@example.com')
    expect(fetch.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ email: 'person@example.com', otp: '123456' }),
    )
  })

  it('shows the signed-in account while a device is pending', () => {
    renderPanel({
      accountPreview: {
        state: {
          devices: [],
          email: 'person@example.com',
          notice: 'none',
          status: 'pending-device',
        },
      },
      initialSection: 'account',
    })

    expect(screen.getByText('person@example.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('shows the signed-out-elsewhere notice distinctly from the paused notice', () => {
    renderPanel({
      accountPreview: {
        state: { notice: 'signed-out-elsewhere', status: 'signed-out' },
      },
      initialSection: 'account',
    })

    expect(screen.getByRole('status').textContent).toBe('Signed out on another device')
  })

  it('shows too many tries in plain words', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse({}, 429)),
    )
    openAccount()
    fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Too many tries')
  })

  it('explains when the connection is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('offline')),
    )
    openAccount()
    fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Check your connection')
  })

  it('explains when consent is refused', async () => {
    vi.spyOn(browser.permissions, 'request').mockResolvedValue(false as never)
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    openAccount()
    fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Lander needs your OK')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('photos', () => {
  /** Open a dropdown by its label and pick an option. */
  const choose = (field: string, option: string) => {
    fireEvent.click(screen.getByRole('combobox', { name: field }))
    fireEvent.click(screen.getByRole('option', { name: option }))
  }

  it('changes how often the photo changes', () => {
    const { onChange } = renderPanel()

    expect(screen.getByRole('combobox', { name: 'Change photo' }).textContent).toBe('Every hour')
    choose('Change photo', 'Every day')

    expect(onChange).toHaveBeenCalledWith(withPhotos({ frequency: 'daily' }))
    // A choice closes the menu.
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('closes only the menu with Escape, not the settings', () => {
    const { onClose } = renderPanel()

    fireEvent.click(screen.getByRole('combobox', { name: 'Change photo' }))
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps the photo on screen when set to never, remembering the frequency', () => {
    const { onChange } = renderPanel()

    choose('Change photo', 'Never')

    expect(onChange).toHaveBeenCalledWith(withPhotos({ mode: 'pinned', pinnedId: 'a' }))
  })

  it('cycles tags chosen from the multi-select', () => {
    const { onChange } = renderPanel()
    const field = screen.getByRole('combobox', { name: 'Tags' })

    expect(field.textContent).toBe('All')
    fireEvent.click(field)
    const menu = within(screen.getByRole('dialog', { name: 'Tags' }))
    expect(menu.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Beach',
      'Water',
    ])
    fireEvent.click(menu.getByRole('option', { name: 'Water' }))

    expect(onChange).toHaveBeenCalledWith(withPhotos({ tags: ['water'] }))
  })

  it('shows the cycled tags as chips, and removes or resets them from the menu', () => {
    const { onChange } = renderPanel({ overrides: withPhotos({ tags: ['water', 'beach'] }) })
    const field = screen.getByRole('combobox', { name: 'Tags' })

    expect(field.textContent).toBe('WaterBeach')
    fireEvent.click(field)
    const menu = within(screen.getByRole('dialog', { name: 'Tags' }))
    // Only the tags not already chosen are offered.
    expect(menu.queryAllByRole('option')).toEqual([])

    fireEvent.click(menu.getByRole('button', { name: 'Remove Water' }))
    expect(onChange).toHaveBeenLastCalledWith(withPhotos({ tags: ['beach'] }))

    fireEvent.click(menu.getByRole('button', { name: 'Reset to all' }))
    expect(onChange).toHaveBeenLastCalledWith(withPhotos({ tags: [] }))
  })

  it('offers the tags only while cycling, and keeps them for when it resumes', () => {
    const { onChange } = renderPanel({
      overrides: withPhotos({ mode: 'pinned', pinnedId: 'b', tags: ['water'] }),
    })

    expect(screen.getByRole('combobox', { name: 'Change photo' }).textContent).toBe('Never')
    expect(screen.queryByRole('combobox', { name: 'Tags' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Resume cycling' }))

    expect(onChange).toHaveBeenCalledWith(
      withPhotos({ mode: 'cycle', pinnedId: 'b', tags: ['water'] }),
    )
  })

  it('keeps the tags when cycling is set to a frequency again', () => {
    const { onChange } = renderPanel({
      overrides: withPhotos({ mode: 'pinned', pinnedId: 'b', tags: ['water'] }),
    })

    choose('Change photo', 'Every day')

    expect(onChange).toHaveBeenCalledWith(
      withPhotos({ frequency: 'daily', mode: 'cycle', pinnedId: 'b', tags: ['water'] }),
    )
  })

  it('filters the gallery to the tag being cycled, when there is one', () => {
    renderPanel({ overrides: withPhotos({ tags: ['beach'] }) })

    const filters = within(screen.getByRole('group', { name: 'Filter photos' }))
    expect(filters.getByRole('button', { name: 'Beach' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('pins a photo picked from the gallery', () => {
    const { onChange } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Tide pools' }))

    expect(onChange).toHaveBeenCalledWith(withPhotos({ mode: 'pinned', pinnedId: 'b' }))
  })

  it('reads tags no photo has as all photos, and clears them on the next change', () => {
    const { onChange } = renderPanel({ overrides: withPhotos({ tags: ['mountains'] }) })

    expect(screen.getByRole('combobox', { name: 'Tags' }).textContent).toBe('All')
    const filters = within(screen.getByRole('group', { name: 'Filter photos' }))
    expect(filters.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByLabelText('Dim the photo'))

    expect(onChange).toHaveBeenCalledWith({ ...settings, dim: false })
  })

  it('clears tags the photos lack from other sections too, such as with the fallback photo', () => {
    const { onChange } = renderPanel({
      overrides: withPhotos({ tags: ['water'] }),
      photos: [makePhoto('fallback')],
    })
    openSection('General')

    fireEvent.click(screen.getByRole('combobox', { name: 'Font' }))
    fireEvent.click(screen.getByRole('option', { name: 'Instrument Serif' }))

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      font: 'instrument-serif',
      photos: { ...settings.photos, tags: [] },
    })
  })

  it('keeps the tags while the photos are loading', () => {
    const { onChange } = renderPanel({ overrides: withPhotos({ tags: ['water'] }), photos: [] })

    expect(screen.getByText('Loading photos…')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Dim the photo'))

    expect(onChange).toHaveBeenCalledWith({ ...withPhotos({ tags: ['water'] }), dim: false })
  })

  it('has no gallery or tags with only one photo', () => {
    renderPanel({ photos: [makePhoto('fallback')] })

    expect(screen.queryByRole('heading', { name: 'Gallery' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Tags' })).toBeNull()
  })

  it('switches the photo wash off', () => {
    const { onChange } = renderPanel()

    fireEvent.click(screen.getByLabelText('Dim the photo'))

    expect(onChange).toHaveBeenCalledWith({ ...settings, dim: false })
  })

  it('grows before it scrolls, holding the top in place', () => {
    renderPanel()
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    const body = screen.getByRole('tabpanel')
    // No layout here: a 1000px section showing 200px, in a popover capped at 800px.
    const grown = () => parseFloat(body.style.getPropertyValue('--popover-grow') || '0')
    dialog.style.maxHeight = '800px'
    Object.defineProperty(dialog, 'offsetHeight', { get: () => 300 + grown() })
    Object.defineProperty(body, 'clientHeight', { get: () => 200 + grown() })
    Object.defineProperty(body, 'scrollHeight', { value: 1000 })
    Object.defineProperty(body, 'scrollTop', { value: 0, writable: true })

    const first = new WheelEvent('wheel', { cancelable: true, deltaY: 450 })
    body.dispatchEvent(first)

    expect(first.defaultPrevented).toBe(true)
    expect(grown()).toBe(450)
    expect(body.scrollTop).toBe(0)

    // 50px short of the cap: the rest of the wheel scrolls.
    body.dispatchEvent(new WheelEvent('wheel', { cancelable: true, deltaY: 100 }))
    expect(grown()).toBe(500)
    expect(body.scrollTop).toBe(50)

    // At the cap, and scrolling up, the browser scrolls as usual.
    const atCap = new WheelEvent('wheel', { cancelable: true, deltaY: 100 })
    body.dispatchEvent(atCap)
    const up = new WheelEvent('wheel', { cancelable: true, deltaY: -100 })
    body.dispatchEvent(up)
    expect(atCap.defaultPrevented).toBe(false)
    expect(up.defaultPrevented).toBe(false)
    expect(grown()).toBe(500)

    // Another section starts at rest again.
    openSection('General')
    expect(grown()).toBe(0)
    expect(body.scrollTop).toBe(0)
  })
})

describe('general', () => {
  it('changes the font', () => {
    const { onChange } = renderPanel()
    openSection('General')

    fireEvent.click(screen.getByRole('combobox', { name: 'Font' }))
    fireEvent.click(screen.getByRole('option', { name: 'Instrument Serif' }))

    expect(onChange).toHaveBeenCalledWith({ ...settings, font: 'instrument-serif' })
  })
})

describe('tour', () => {
  const TOUR: SettingsStop[] = [
    { body: 'About the font.', id: 'tour-general', section: 'general', title: 'Font stop' },
    { body: 'About the photos.', id: 'tour-photos', section: 'photos', title: 'Photos stop' },
  ]

  const renderTour = () => {
    const onClose = vi.fn()
    render(
      <SettingsPanel
        currentId="a"
        onChange={vi.fn()}
        onClose={onClose}
        photos={PHOTOS}
        settings={settings}
        tour={TOUR}
      />,
    )
    return { onClose }
  }

  const selectedTab = () => screen.getByRole('tab', { selected: true }).textContent

  it('opens on the section named by initialSection', () => {
    render(
      <SettingsPanel
        currentId="a"
        initialSection="general"
        onChange={vi.fn()}
        onClose={vi.fn()}
        photos={PHOTOS}
        settings={settings}
      />,
    )

    expect(selectedTab()).toBe('General')
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('starts on the first stop and its section', () => {
    renderTour()

    expect(selectedTab()).toBe('General')
    const note = screen.getByRole('note')
    expect(within(note).getByText('Font stop')).toBeTruthy()
    expect(within(note).getByText('About the font.')).toBeTruthy()
    expect(within(note).getByText('1 of 2')).toBeTruthy()
  })

  it('moves to the next stop and its section, and ends after the last', async () => {
    renderTour()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    // The note fades out first, and comes back as the next stop.
    expect(screen.getByRole('note').classList.contains('callout--leaving')).toBe(true)
    await waitFor(() => expect(selectedTab()).toBe('Photos'))
    expect(within(screen.getByRole('note')).getByText('2 of 2')).toBeTruthy()
    expect(screen.getByRole('note').classList.contains('callout--leaving')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
    expect(selectedTab()).toBe('Photos')
  })

  it('follows a section opened by hand, and stays put on one it has no stop for', () => {
    renderTour()

    openSection('Photos')
    expect(within(screen.getByRole('note')).getByText('Photos stop')).toBeTruthy()

    openSection('General')
    expect(within(screen.getByRole('note')).getByText('Font stop')).toBeTruthy()
  })

  it('counts the stops with the ones on the page when it carries on from them', () => {
    render(
      <SettingsPanel
        currentId="a"
        onChange={vi.fn()}
        onClose={vi.fn()}
        photos={PHOTOS}
        settings={settings}
        tour={TOUR}
        tourProgress={{ before: 5, total: 7 }}
      />,
    )

    expect(within(screen.getByRole('note')).getByText('6 of 7')).toBeTruthy()
  })

  it('has focus on the Close button when it is opened alone, and on its Next button when it carries on from the page', () => {
    const { unmount } = render(
      <SettingsPanel
        currentId="a"
        onChange={vi.fn()}
        onClose={vi.fn()}
        photos={PHOTOS}
        settings={settings}
        tour={TOUR}
      />,
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close settings' }))
    unmount()

    render(
      <SettingsPanel
        currentId="a"
        onChange={vi.fn()}
        onClose={vi.fn()}
        photos={PHOTOS}
        settings={settings}
        tour={TOUR}
        tourProgress={{ before: 5, total: 7 }}
      />,
    )
    // Where the page's Next button had it: the next press goes on with the tour.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }))
  })

  it('puts focus on the Close button when the last stop is done, or the note dismissed', async () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(selectedTab()).toBe('Photos'))
    const done = screen.getByRole('button', { name: 'Done' })
    done.focus()

    fireEvent.click(done)

    await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close settings' }))
  })

  it('leaves focus alone when the tour ends with it on something else', async () => {
    renderTour()
    const tab = screen.getByRole('tab', { name: 'Photos' })
    tab.focus()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
    expect(document.activeElement).toBe(tab)
  })

  it('ends when dismissed, without closing the settings', async () => {
    const { onClose } = renderTour()

    // A press on the note is inside the panel, not a click outside it.
    fireEvent.pointerDown(screen.getByRole('note'))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()

    // And it doesn't come back with the next section.
    openSection('General')
    expect(screen.queryByRole('note')).toBeNull()
  })
})

describe('SettingsPanel, when the settings are from a newer version', () => {
  const LINE = 'Update Lander to change this.'

  const renderReadOnly = (readOnly: boolean, shown: Settings = settings) => {
    const onChange = vi.fn()
    render(
      <SettingsPanel
        currentId="a"
        onChange={onChange}
        onClose={() => {}}
        photos={PHOTOS}
        readOnly={readOnly}
        settings={shown}
      />,
    )
    return { onChange }
  }

  /**
   * Every control in the open section, which the browser turns off with the fieldset around them
   * (the test DOM does not, so this looks for the fieldset).
   */
  const controlsInDisabledFieldset = () => {
    const section = screen.getByRole('tabpanel')
    const fieldset = section.querySelector('fieldset[disabled]')
    // The Edit button in General is not one of them: it changes no setting (see below).
    const controls = [...section.querySelectorAll('button, input, select')].filter(
      (control) => control.textContent !== 'Edit',
    )
    return { all: controls, inside: controls.filter((control) => fieldset?.contains(control)) }
  }

  it('says to update, at the top, and puts every control in the section in a disabled fieldset', () => {
    renderReadOnly(true)

    expect(screen.getByText(LINE)).toBeTruthy()
    const { all, inside } = controlsInDisabledFieldset()
    expect(all.length).toBeGreaterThan(0)
    expect(inside).toEqual(all)
  })

  it('describes the disabled fieldset with the line, so a screen reader hears why', () => {
    renderReadOnly(true)

    const fieldset = screen.getByRole('tabpanel').querySelector('fieldset[disabled]')
    const describedBy = fieldset?.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(LINE)
  })

  it('has no description on the fieldset when the settings can be changed', () => {
    renderReadOnly(false)

    expect(
      screen.getByRole('tabpanel').querySelector('fieldset')?.hasAttribute('aria-describedby'),
    ).toBe(false)
  })

  it('does so in every section, and keeps the tabs enabled to look around', () => {
    renderReadOnly(true)

    for (const name of ['General', 'Photos']) {
      openSection(name)
      const { all, inside } = controlsInDisabledFieldset()
      expect(all.length).toBeGreaterThan(0)
      expect(inside).toEqual(all)
    }
    expect(screen.getByRole('tab', { name: 'General' }).closest('fieldset')).toBeNull()
  })

  it('is as it was, with no line, when the settings can be changed', () => {
    renderReadOnly(false)

    expect(screen.queryByText(LINE)).toBeNull()
    expect(screen.getByRole('tabpanel').querySelector('fieldset[disabled]')).toBeNull()
  })
})
