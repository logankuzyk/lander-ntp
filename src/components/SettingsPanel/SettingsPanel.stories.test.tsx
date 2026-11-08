import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { onboardingItem } from '@/onboarding/storage'

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
    ['Photo', 'Background'],
    ['Colour', 'Background'],
    ['ColourCustom', 'Background'],
    ['ColourHexError', 'Background'],
    ['PhotosCycling', 'Background'],
    ['PhotosKept', 'Background'],
    ['General', 'General'],
    ['WithTheTour', 'Background'],
    ['FromNewerVersion', 'Background'],
  ] as const)('%s opens on %s', (name, tab) => {
    renderStory(name)

    expect(selectedTab()).toBe(tab)
  })

  it('shows the photo as kept in PhotosKept', () => {
    renderStory('PhotosKept')

    expect(screen.getByText(/Keeping this photo/)).toBeTruthy()
  })

  it('walks the tour in WithTheTour', () => {
    renderStory('WithTheTour')

    expect(screen.getByText('1 of 2')).toBeTruthy()
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

  it('keeps the settings in state, so a switch responds', () => {
    renderStory('PhotosCycling')
    const dim = screen.getByRole('switch', { name: 'Dim the photo' }) as HTMLInputElement
    expect(dim.checked).toBe(true)

    fireEvent.click(dim)

    expect(
      (screen.getByRole('switch', { name: 'Dim the photo' }) as HTMLInputElement).checked,
    ).toBe(false)
  })

  it('marks the Background tab as new until it is selected', async () => {
    await onboardingItem.setValue({ dismissed: [], welcomed: true })
    renderStory('TabNew')

    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: /Background/ }).querySelector('.new-mark'),
      ).toBeTruthy(),
    )
    expect((await onboardingItem.getValue())?.dismissed).not.toContain('photos')
    fireEvent.click(screen.getByRole('tab', { name: 'Background' }))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Background/ }).querySelector('.new-mark')).toBeNull(),
    )
    await waitFor(async () =>
      expect((await onboardingItem.getValue())?.dismissed).toContain('photos'),
    )
  })
})
