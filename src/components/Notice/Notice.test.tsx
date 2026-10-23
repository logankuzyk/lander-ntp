import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { Notice } from './Notice'

describe('Notice', () => {
  it('says its line in a live region, so it is read out when it appears', () => {
    render(<Notice message="Couldn't save that. Try again in a minute." onDismiss={() => {}} />)

    expect(screen.getByRole('status').textContent).toContain(
      "Couldn't save that. Try again in a minute.",
    )
  })

  it('is dismissed with its button, and has no other', () => {
    const onDismiss = vi.fn()
    render(<Notice message="Gone soon." onDismiss={onDismiss} />)

    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
