import type { StoryContext } from '@storybook/preact-vite'
import { render, screen } from '@testing-library/preact'
import { afterEach, describe, expect, it } from 'vitest'

import { FONTS } from '@/settings/fonts'

import { withPage } from './withPage'

const Story = () => <p>The story</p>

const renderWithPage = (globals: Record<string, unknown>) =>
  render(<>{withPage(Story, { globals } as StoryContext)}</>)

const displayFont = () => document.documentElement.style.getPropertyValue('--font-display')

describe('withPage', () => {
  afterEach(() => document.documentElement.style.removeProperty('--font-display'))

  it('draws the story inside the page wrapper, at least as tall as the window', () => {
    renderWithPage({ font: 'system' })

    const app = screen.getByText('The story').parentElement
    expect(app?.classList.contains('app')).toBe(true)
    expect(app?.style.minHeight).toBe('100vh')
  })

  it('centres the story, which the page itself no longer does', () => {
    renderWithPage({ font: 'system' })

    const { display, placeItems } = (screen.getByText('The story').parentElement as HTMLElement)
      .style
    expect(display).toBe('grid')
    expect(placeItems).toBe('center')
  })

  it('sets the display font from the toolbar, as the page does from settings', () => {
    renderWithPage({ font: 'instrument-serif' })

    expect(displayFont()).toBe(FONTS['instrument-serif'].stack)
  })

  it('uses the system font when the toolbar has none', () => {
    renderWithPage({})

    expect(displayFont()).toBe(FONTS.system.stack)
  })
})
