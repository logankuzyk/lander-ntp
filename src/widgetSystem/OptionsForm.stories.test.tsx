import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { settingsItem } from '@/settings/storage'

import meta, * as stories from './OptionsForm.stories'

type StoryName = Exclude<keyof typeof stories, 'default'>

/**
 * Draws a story as Storybook does, minus the decorators: its storage seeded by its `beforeEach`
 * (the story's own, else the meta's), then its args through the meta's render. The form is drawn
 * once the settings have been read, so a test waits for something in it.
 */
async function renderStory(name: StoryName) {
  const story = stories[name] as { args?: object; beforeEach?: () => Promise<void> }
  await (story.beforeEach ?? meta.beforeEach)()
  const args = { ...meta.args, ...story.args }
  render(<>{meta.render(args as never)}</>)
}

const checked = (name: string) => (screen.getByRole('switch', { name }) as HTMLInputElement).checked

describe('options form stories', () => {
  it('Clock draws the three switches, seeded from storage, and responds', async () => {
    await renderStory('Clock')
    await screen.findByRole('switch', { name: 'Show date' })

    expect(screen.getAllByRole('switch').map((el) => el.closest('label')?.textContent)).toEqual([
      'Show date',
      'Show seconds',
      '24-hour time',
    ])
    expect(checked('Show date')).toBe(true)
    expect(checked('Show seconds')).toBe(false)
    // The stored settings are 24-hour, so the switch that is the opposite of hour12 is on.
    expect(checked('24-hour time')).toBe(true)

    fireEvent.click(screen.getByRole('switch', { name: 'Show seconds' }))
    await waitFor(() => expect(checked('Show seconds')).toBe(true))
    await waitFor(async () => expect((await settingsItem.getValue()).clock.showSeconds).toBe(true))

    fireEvent.click(screen.getByRole('switch', { name: '24-hour time' }))
    await waitFor(() => expect(checked('24-hour time')).toBe(false))
    await waitFor(async () => expect((await settingsItem.getValue()).clock.hour12).toBe(true))
  })

  it('Weather draws every option, with the place named and the credit', async () => {
    await renderStory('Weather')

    await screen.findByText(/^Victoria/)
    expect(screen.getByRole('combobox', { name: 'Units' }).textContent).toContain('Celsius')
    expect(screen.getByRole('list', { name: 'Show' })).toBeTruthy()
    expect(checked('24-hour time')).toBe(true)
    expect(screen.getByRole('link', { name: 'Weather data by Open-Meteo.com' })).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: 'Search for a place' })).toBeNull()
  })

  it('Weather responds to a change, keeping the rest of the options', async () => {
    await renderStory('Weather')
    await screen.findByText(/^Victoria/)

    fireEvent.click(screen.getByRole('combobox', { name: 'Units' }))
    fireEvent.click(screen.getByRole('option', { name: 'Fahrenheit' }))

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Units' }).textContent).toContain('Fahrenheit'),
    )
    // Saved one at a time, after the form has shown the change.
    await waitFor(async () =>
      expect((await settingsItem.getValue()).weather.unit).toBe('fahrenheit'),
    )
    const { weather } = await settingsItem.getValue()
    expect(weather.place?.name).toBe('Victoria')
  })

  it('WeatherNoPlace has the focus in the place search, and sends nothing', async () => {
    const fetched = vi.fn(() => Promise.reject(new Error('the network')))
    vi.stubGlobal('fetch', fetched)
    try {
      await renderStory('WeatherNoPlace')

      const search = await screen.findByRole('combobox', { name: 'Search for a place' })
      await waitFor(() => expect(document.activeElement).toBe(search))
      expect(fetched).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('Disabled draws the options as they are with every control off', async () => {
    await renderStory('Disabled')

    await screen.findByText(/^Victoria/)
    expect(screen.getByRole('combobox', { name: 'Units' }).textContent).toContain('Celsius')
    for (const control of [
      ...screen.getAllByRole('switch'),
      ...screen.getAllByRole('combobox'),
      screen.getByRole('button', { name: 'Change' }),
      screen.getByRole('button', { name: 'Show Location' }),
    ]) {
      expect((control as HTMLButtonElement | HTMLInputElement).disabled).toBe(true)
    }
  })
})
