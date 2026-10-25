import { fireEvent, render, screen } from '@testing-library/preact'
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
    ['ClockOn', 'Clock'],
    ['ClockOff', 'Clock'],
    ['WeatherOff', 'Weather'],
    ['WeatherOn', 'Weather'],
    ['WeatherChoosingAPlace', 'Weather'],
    ['General', 'General'],
    ['WithTheTour', 'Photos'],
    ['FromNewerVersion', 'Photos'],
  ] as const)('%s opens on %s', (name, tab) => {
    renderStory(name)

    expect(selectedTab()).toBe(tab)
  })

  it('shows the photo as kept in PhotosKept', () => {
    renderStory('PhotosKept')

    expect(screen.getByText(/Keeping this photo/)).toBeTruthy()
  })

  it('shows the place search in WeatherChoosingAPlace and the place in WeatherOn', () => {
    const search = renderStory('WeatherChoosingAPlace')
    expect(screen.getByRole('combobox', { name: 'Search for a place' })).toBeTruthy()
    search.unmount()

    renderStory('WeatherOn')
    expect(screen.getByText('Victoria')).toBeTruthy()
  })

  it('walks the tour in WithTheTour', () => {
    renderStory('WithTheTour')

    expect(screen.getByText('1 of 4')).toBeTruthy()
  })

  it('says to update, and turns the section off, in FromNewerVersion', () => {
    renderStory('FromNewerVersion')

    expect(screen.getByText('Update Lander to change this.')).toBeTruthy()
    expect(screen.getByRole('tabpanel').querySelector('fieldset[disabled]')).not.toBeNull()
  })

  it('keeps the settings in state, so a switch responds', () => {
    renderStory('ClockOn')
    const showDate = screen.getByRole('switch', { name: 'Show date' }) as HTMLInputElement
    expect(showDate.checked).toBe(false)

    fireEvent.click(showDate)

    expect((screen.getByRole('switch', { name: 'Show date' }) as HTMLInputElement).checked).toBe(
      true,
    )
  })
})
