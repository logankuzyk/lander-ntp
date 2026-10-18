import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import meta, * as stories from './SettingsPanel.stories'

const { default: _meta, ...STORIES } = stories
void _meta

/** Draws a story as Storybook does, minus the page decorator: its args through the meta's render. */
const renderStory = (name: keyof typeof STORIES) => {
  const args = { ...meta.args, ...STORIES[name].args }
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

  it('keeps the settings in state, so a switch responds', () => {
    renderStory('ClockOn')
    const showDate = screen.getByRole('switch', { name: 'Show date' }) as HTMLInputElement
    expect(showDate.checked).toBe(false)

    fireEvent.click(showDate)

    expect((screen.getByRole('switch', { name: 'Show date' }) as HTMLInputElement).checked).toBe(
      true,
    )
  })

  it('hides the clock options once the clock is switched off', () => {
    renderStory('ClockOn')

    fireEvent.click(screen.getByRole('switch', { name: 'Show clock' }))

    expect(screen.queryByRole('switch', { name: 'Show date' })).toBeNull()
  })
})
