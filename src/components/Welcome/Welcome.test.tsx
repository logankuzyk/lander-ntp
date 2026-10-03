import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Welcome } from './Welcome'

const renderWelcome = () => {
  const onSkip = vi.fn()
  const onTour = vi.fn()
  render(<Welcome onSkip={onSkip} onTour={onTour} />)
  return { onSkip, onTour }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Welcome', () => {
  it('opens as a modal named by the wordmark', () => {
    renderWelcome()

    const dialog = screen.getByRole<HTMLDialogElement>('dialog', { name: 'Welcome to Lander' })
    expect(dialog.open).toBe(true)
  })

  it('offers the tour, fading out before it starts', async () => {
    const { onSkip, onTour } = renderWelcome()
    const tour = screen.getByRole('button', { name: 'Show me around' })

    fireEvent.click(tour)
    // A second press during the fade is not a second answer.
    fireEvent.click(tour)

    expect(screen.getByRole('dialog').classList.contains('welcome--leaving')).toBe(true)
    expect(onTour).not.toHaveBeenCalled()

    await waitFor(() => expect(onTour).toHaveBeenCalledOnce())
    expect(onSkip).not.toHaveBeenCalled()
  })

  it('can be skipped with the button', async () => {
    const { onSkip, onTour } = renderWelcome()

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    await waitFor(() => expect(onSkip).toHaveBeenCalledOnce())
    expect(onTour).not.toHaveBeenCalled()
  })

  it('fades out on Escape rather than closing on the spot', async () => {
    const { onSkip } = renderWelcome()
    // What the browser fires for Escape, before it closes a modal.
    const cancel = new Event('cancel', { cancelable: true })

    fireEvent(screen.getByRole('dialog'), cancel)

    expect(cancel.defaultPrevented).toBe(true)
    expect(onSkip).not.toHaveBeenCalled()
    await waitFor(() => expect(onSkip).toHaveBeenCalledOnce())
  })

  it('counts as skipped if the browser closes it anyway', () => {
    const { onSkip } = renderWelcome()

    fireEvent(screen.getByRole('dialog'), new Event('close'))

    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('does not wait when motion is turned down', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { onSkip } = renderWelcome()

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(onSkip).toHaveBeenCalledOnce()
  })
})
