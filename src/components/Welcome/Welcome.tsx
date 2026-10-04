import { useEffect, useRef } from 'preact/hooks'

import { Wordmark } from '@/components/Wordmark/Wordmark'
import { useLeave } from '@/onboarding/useLeave'

type WelcomeProps = {
  /** Closed without the tour: Skip or Escape. */
  onSkip: () => void
  onTour: () => void
}

/**
 * Greets a new install, in the middle of the page, and offers a tour of the settings. It fades
 * in, and out again before the answer is acted on.
 */
export function Welcome({ onSkip, onTour }: WelcomeProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { leave, leaving } = useLeave()

  // As a modal, so focus stays inside and the page behind is out of reach until it is answered.
  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog
      aria-labelledby="welcome-heading"
      class={leaving ? 'welcome welcome--leaving' : 'welcome'}
      // Escape would close a modal dialog on the spot: held back, so it fades like a skip.
      onCancel={(event) => {
        event.preventDefault()
        leave(onSkip)
      }}
      // The browser closes it regardless on a second Escape.
      onClose={onSkip}
      ref={dialog}
    >
      <h1 id="welcome-heading">
        <span class="visually-hidden">Welcome to </span>
        <Wordmark />
      </h1>
      <p>
        It's great to have you here! Take a minute to set how often the photo changes, and what sits
        on top of it.
      </p>
      <div class="welcome__actions">
        <button class="welcome__skip" onClick={() => leave(onSkip)} type="button">
          Skip
        </button>
        <button class="callout__action" onClick={() => leave(onTour)} type="button">
          Show me around
        </button>
      </div>
    </dialog>
  )
}
