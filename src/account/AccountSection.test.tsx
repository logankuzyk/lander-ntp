import { fireEvent, render, screen, within } from '@testing-library/preact'
import { vi } from 'vitest'

import { account } from './account'
import type { AccountState, Device } from './account'
import { AccountSection } from './AccountSection'

const devices: Device[] = [
  {
    browser: 'Firefox',
    createdAt: '2026-10-01T00:00:00.000Z',
    current: false,
    id: 'old-device',
    lastUsedAt: '2026-10-15T00:00:00.000Z',
    os: 'Windows',
  },
  {
    browser: 'Chrome',
    createdAt: '2026-10-02T00:00:00.000Z',
    current: true,
    id: 'this-device',
    lastUsedAt: '2026-10-17T00:00:00.000Z',
    os: 'macOS',
  },
]

const signedIn: AccountState = {
  devices,
  email: 'person@example.com',
  notice: 'none',
  status: 'signed-in',
}

describe('AccountSection', () => {
  it('lists devices and identifies this device', () => {
    render(<AccountSection stateOverride={signedIn} />)

    expect(screen.getByText('Up to 3 devices')).toBeTruthy()
    expect(screen.getByText('Firefox on Windows, 3 weeks ago')).toBeTruthy()
    expect(screen.getByText('This device')).toBeTruthy()
    expect(
      within(screen.getByRole('list')).getAllByRole('button', { name: 'Sign out' }),
    ).toHaveLength(2)
    expect(screen.queryByText('Choose a device to sign out so this one can sync')).toBeNull()
  })

  it('removes a device selected from the list', async () => {
    const removeDevice = vi
      .spyOn(account, 'removeDevice')
      .mockResolvedValue({ ok: true, value: undefined })
    render(<AccountSection stateOverride={signedIn} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0]!)

    expect(removeDevice).toHaveBeenCalledWith('old-device')
    removeDevice.mockRestore()
  })

  it('asks before deleting the account and explains what stays on this device', () => {
    render(<AccountSection stateOverride={signedIn} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))

    expect(screen.getByRole('dialog', { name: 'Delete account' })).toBeTruthy()
    expect(screen.getByText(/email, settings and device list/)).toBeTruthy()
    expect(screen.getByText(/page and browser sync/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm delete account' })).toBeTruthy()
  })

  it('offers a device picker only to a pending device, with a cancel action', () => {
    render(
      <AccountSection
        stateOverride={{
          devices,
          email: 'person@example.com',
          notice: 'none',
          status: 'pending-device',
        }}
      />,
    )

    expect(screen.getByText('Choose a device to sign out so this one can sync')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('cancels the pending device by signing it out', () => {
    const signOut = vi.spyOn(account, 'signOut').mockResolvedValue({ ok: true, value: undefined })
    render(
      <AccountSection
        stateOverride={{
          devices,
          email: 'person@example.com',
          notice: 'none',
          status: 'pending-device',
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(signOut).toHaveBeenCalledOnce()
    signOut.mockRestore()
  })

  it('keeps the delete confirmation open and shows an error when deletion fails', async () => {
    const deleteAccount = vi
      .spyOn(account, 'deleteAccount')
      .mockResolvedValue({ error: 'network-error', ok: false })
    render(<AccountSection stateOverride={signedIn} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete account' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(deleteAccount).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog', { name: 'Delete account' })).toBeTruthy()
    deleteAccount.mockRestore()
  })
})
