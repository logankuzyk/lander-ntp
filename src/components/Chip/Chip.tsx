type ChipProps = {
  label: string
  /** Makes it a toggle button, pressed or not. */
  onClick?: () => void
  /** Adds a × that removes it. */
  onRemove?: () => void
  pressed?: boolean
  /** `s` sits on a line of text, inside a field; `m` is as tall as any other control. */
  size?: 'm' | 's'
}

/** A tag: a toggle when it has onClick, removable when it has onRemove, otherwise a label. */
export function Chip({ label, onClick, onRemove, pressed, size = 'm' }: ChipProps) {
  const className = `chip chip--${size}`

  if (onClick) {
    return (
      <button aria-pressed={pressed} class={className} onClick={onClick} type="button">
        {label}
      </button>
    )
  }

  return (
    <span class={onRemove ? `${className} chip--removable` : className}>
      {label}
      {onRemove && (
        <button
          aria-label={`Remove ${label}`}
          class="chip__remove"
          onClick={onRemove}
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="10"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="3"
            viewBox="0 0 24 24"
            width="10"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </span>
  )
}
