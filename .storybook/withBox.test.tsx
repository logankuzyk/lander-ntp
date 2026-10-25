import type { StoryContext } from '@storybook/preact-vite'
import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { withBox } from './withBox'

const Story = () => <p>The story</p>

const renderWithBox = (parameters: Record<string, unknown>) =>
  render(<>{withBox(Story, { parameters } as StoryContext)}</>)

const boxOfStory = () => screen.getByText('The story').parentElement as HTMLElement

describe('withBox', () => {
  it("draws the story in a box on a Grid, as the page does, at the story's place", () => {
    renderWithBox({ box: { col: 11, h: 2, row: 1, w: 2 } })

    const box = boxOfStory()
    expect(box.classList.contains('widget-box')).toBe(true)
    expect(box.parentElement?.classList.contains('grid')).toBe(true)
    expect(box.style.gridColumn).toBe('11 / span 2')
    expect(box.style.gridRow).toBe('1 / span 2')
  })

  it("puts a story that does not say where in the middle, at the Clock's starting size", () => {
    renderWithBox({})

    const box = boxOfStory()
    expect(box.style.gridColumn).toBe('5 / span 4')
    expect(box.style.gridRow).toBe('4 / span 2')
  })
})
