import { useEffect } from 'preact/hooks'

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))

/**
 * Keys pressed inside a popover belong to it: arrows move between its tabs and chips. Likewise
 * the welcome, which is a modal: nothing behind it should answer.
 */
const inPopover = (target: EventTarget | null) =>
  target instanceof Element && target.closest('.popover, dialog') !== null

type ControlsProps = {
  /** True while the photo being faded in is still loading. */
  busy?: boolean
  infoOpen?: boolean
  onNext: () => void
  /** Omitted when the photo details widget is switched off. */
  onToggleInfo?: () => void
  onToggleSettings: () => void
  settingsOpen?: boolean
}

/** Bottom-right controls. The → and i keys do the same as the buttons. */
export function Controls({
  busy,
  infoOpen,
  onNext,
  onToggleInfo,
  onToggleSettings,
  settingsOpen,
}: ControlsProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditable(event.target) ||
        inPopover(event.target)
      ) {
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (!busy) onNext()
      } else if (event.key === 'i' && onToggleInfo) {
        event.preventDefault()
        onToggleInfo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onNext, busy, onToggleInfo])

  return (
    <div class="controls">
      <button
        aria-busy={busy === true}
        aria-label="Next photo"
        class={busy ? 'control control--busy' : 'control'}
        // Ignored rather than disabled while the next photo loads: each press would stack
        // another full-resolution image over the one the wait is already for. The button
        // keeps its place in the Tab order so focus does not jump away mid-press.
        onClick={busy ? undefined : onNext}
        title="Next photo (→)"
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
      {onToggleInfo && (
        <button
          aria-expanded={infoOpen === true}
          aria-label="Photo details"
          class="control"
          // Opens and closes the popover itself, so pressing it isn't a click outside.
          data-popover-toggle
          onClick={onToggleInfo}
          title="Photo details (i)"
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="20"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            viewBox="0 0 24 24"
            width="20"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
          </svg>
        </button>
      )}
      <button
        aria-expanded={settingsOpen === true}
        aria-label="Settings"
        class="control"
        data-popover-toggle
        onClick={onToggleSettings}
        title="Settings"
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          viewBox="0 0 24 24"
          width="20"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  )
}
