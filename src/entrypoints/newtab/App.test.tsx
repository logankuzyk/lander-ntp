import { render } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('renders the clock', () => {
    // <time> has no implicit ARIA role, so query the element directly.
    const { container } = render(<App />)
    const clock = container.querySelector('time')
    expect(clock?.getAttribute('datetime')).toBeTruthy()
    expect(clock?.textContent).toMatch(/^\d{1,2}:\d{2}$/)
  })
})
