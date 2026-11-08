import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { FirstSignInChoice } from './FirstSignInChoice'

describe('first sign-in choice', () => {
  it('shows the choice only while syncStatus needs a choice', () => {
    const choose = vi.fn()
    const { rerender } = render(
      <FirstSignInChoice choose={choose} syncStatus={{ needsChoice: false }} />,
    )

    expect(screen.queryByRole('region', { name: 'Choose which page to keep' })).toBeNull()

    rerender(<FirstSignInChoice choose={choose} syncStatus={{ needsChoice: true }} />)

    expect(screen.getByRole('region', { name: 'Choose which page to keep' })).toBeTruthy()
    expect(screen.getByText('This choice covers every setting and the Layout.')).toBeTruthy()
  })

  it.each([
    ["Use your account's page", 'account'],
    ["Keep this browser's", 'browser'],
  ] as const)('%s asks sync to keep the %s page once', (label, value) => {
    const choose = vi.fn()
    render(<FirstSignInChoice choose={choose} syncStatus={{ needsChoice: true }} />)

    const button = screen.getByRole('button', { name: label })
    fireEvent.click(button)

    expect(choose).toHaveBeenCalledTimes(1)
    expect(choose).toHaveBeenCalledWith(value)
  })
})
