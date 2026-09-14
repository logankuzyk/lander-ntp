import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { settingsItem } from './storage'
import { useStorageItem } from './useStorageItem'

function FontPicker() {
  const [settings, setSettings, loaded] = useStorageItem(settingsItem)
  return (
    <>
      <button type="button" onClick={() => setSettings({ ...settings, font: 'inter' })}>
        {settings.font}
      </button>
      <span data-testid="loaded">{String(loaded)}</span>
    </>
  )
}

describe('useStorageItem', () => {
  it('starts from the fallback, then swaps in the stored value', async () => {
    await settingsItem.setValue({ ...settingsItem.fallback, font: 'fraunces' })

    render(<FontPicker />)
    const button = screen.getByRole('button')

    expect(button.textContent).toBe('system')
    await waitFor(() => expect(button.textContent).toBe('fraunces'))
  })

  it('says whether the stored value has arrived, so callers need not act on the fallback', async () => {
    render(<FontPicker />)

    expect(screen.getByTestId('loaded').textContent).toBe('false')

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'))
  })

  it('writes updates to storage', async () => {
    render(<FontPicker />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('inter'))
    await waitFor(async () => expect((await settingsItem.getValue()).font).toBe('inter'))
  })

  it('picks up changes made elsewhere, so open tabs stay in sync', async () => {
    render(<FontPicker />)
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('system'))

    await act(async () => {
      await settingsItem.setValue({ ...settingsItem.fallback, font: 'jetbrains-mono' })
    })

    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('jetbrains-mono'))
  })
})
