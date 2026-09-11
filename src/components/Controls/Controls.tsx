import { useEffect } from 'preact/hooks'

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

type ControlsProps = {
  onNext: () => void
}

/** Bottom-right controls. The → key also shows the next photo. */
export function Controls({ onNext }: ControlsProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'ArrowRight' ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditable(event.target)
      ) {
        return
      }
      event.preventDefault()
      onNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onNext])

  return (
    <div class="controls">
      <button
        type="button"
        class="control"
        aria-label="Next photo"
        title="Next photo (→)"
        onClick={onNext}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  )
}
