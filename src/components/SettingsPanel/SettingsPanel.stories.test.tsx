import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import meta, * as stories from './SettingsPanel.stories'

type StoryName = Exclude<keyof typeof stories, 'default'>

/** Draws a story as Storybook does, minus the page decorator: its args through the meta's render. */
const renderStory = (name: StoryName) => {
  const args = { ...meta.args, ...stories[name].args }
  return render(<>{meta.render(args as never)}</>)
}

const selectedTab = () => screen.getByRole('tab', { selected: true }).textContent

describe('settings panel stories', () => {
  it.each([
    ['PhotosCycling', 'Photos'],
    ['PhotosKept', 'Photos'],
    ['General', 'General'],
    ['WithTheTour', 'Photos'],
    ['AccountSignedOut', 'Account'],
    ['AccountCodeSent', 'Account'],
    ['AccountWrongCode', 'Account'],
    ['AccountSignedIn', 'Account'],
    ['AccountTwoDevices', 'Account'],
    ['AccountThreeDevices', 'Account'],
    ['AccountPendingDevice', 'Account'],
    ['AccountDeleteConfirm', 'Account'],
    ['AccountDeleteFailed', 'Account'],
    ['AccountNeverSynced', 'Account'],
    ['AccountSignedOutElsewhere', 'Account'],
    ['AccountPaused', 'Account'],
    ['AccountConsentRefused', 'Account'],

    ['FromNewerVersion', 'Photos'],
  ] as const)('%s opens on %s', (name, tab) => {
    renderStory(name)

    expect(selectedTab()).toBe(tab)
  })

  it('shows the photo as kept in PhotosKept', () => {
    renderStory('PhotosKept')

    expect(screen.getByText(/Keeping this photo/)).toBeTruthy()
  })

  it('walks the tour in WithTheTour', async () => {
    renderStory('WithTheTour')

    const note = () => screen.getByRole('note')
    expect(note().textContent).toContain('1 of 3')
    expect(note().textContent).toContain('Photos')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(note().textContent).toContain('2 of 3'))
    expect(note().textContent).toContain('Account')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(note().textContent).toContain('3 of 3'))
    expect(note().textContent).toContain('Font')
  })

  it('says to update, and turns the section off, in FromNewerVersion', () => {
    renderStory('FromNewerVersion')

    expect(screen.getByText('Update Lander to change this.')).toBeTruthy()
    expect(screen.getByRole('tabpanel').querySelector('fieldset[disabled]')).not.toBeNull()
  })

  it('points to Edit in General, and in no other story has anything of the Clock or the Weather', () => {
    renderStory('General')

    expect(screen.getByText('Clock and Weather options are on the widgets now.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: /clock|weather/i })).toBeNull()
  })

  it('shows the code field in AccountCodeSent', () => {
    renderStory('AccountCodeSent')
    expect(screen.getByLabelText('Code')).toBeTruthy()
  })

  it('shows the wrong-code message in AccountWrongCode', () => {
    renderStory('AccountWrongCode')
    expect(screen.getByRole('alert').textContent).toContain('wrong or has expired')
  })

  it('shows the signed-in account in AccountSignedIn', () => {
    renderStory('AccountSignedIn')
    expect(screen.getByText('person@example.com')).toBeTruthy()
    expect(screen.getByText('Not synced yet')).toBeTruthy()
  })

  it('keeps the settings in state, so a switch responds', () => {
    renderStory('PhotosCycling')
    const dim = screen.getByRole('switch', { name: 'Dim the photo' }) as HTMLInputElement
    expect(dim.checked).toBe(true)

    fireEvent.click(dim)

    expect(
      (screen.getByRole('switch', { name: 'Dim the photo' }) as HTMLInputElement).checked,
    ).toBe(false)
  })
})
