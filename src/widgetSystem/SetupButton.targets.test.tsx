import { render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { findTarget } from '@/onboarding/target'

import { SetupButton, type SetupNeed } from './SetupButton'

const need = (action: SetupNeed<unknown>['action']): SetupNeed<unknown> => ({
  action,
  id: 'place',
  label: 'Choose a place',
  met: () => false,
})

describe('SetupButton, for a callout', () => {
  it('names its button as a thing to point at, when pressing it opens options', () => {
    render(
      <SetupButton
        id="weather1"
        name="Weather"
        need={need({ kind: 'option', option: 'place' })}
        onAsked={vi.fn()}
      />,
    )
    const button = screen.getByRole('button', { name: 'Weather, Choose a place' })

    expect(button.getAttribute('data-callout-target')).toBe('setup')
  })

  it('names its button as a thing to point at, when pressing it asks the browser', () => {
    render(
      <SetupButton name="Weather" need={need({ kind: 'ask', run: vi.fn() })} onAsked={vi.fn()} />,
    )
    const button = screen.getByRole('button', { name: 'Weather, Choose a place' })

    expect(button.getAttribute('data-callout-target')).toBe('setup')
    // (The test DOM draws nothing, so it is found when it is given a box.)
    button.getBoundingClientRect = () => new DOMRect(10, 10, 100, 30)
    expect(findTarget('setup')).toBe(button)
  })
})
