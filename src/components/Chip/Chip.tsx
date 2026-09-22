type ChipProps = {
  label: string
  /** `s` sits on a line of text, inside a field; `m` is as tall as any other control. */
  size?: 's' | 'm'
  /** Makes it a toggle button, pressed or not. */
  onClick?: () => void
  pressed?: boolean
  /** Adds a × that removes it. */
  onRemove?: () => void
}

/** A tag: a toggle when it has onClick, removable when it has onRemove, otherwise a label. */
export function Chip({ label, size = 'm', onClick, pressed, onRemove }: ChipProps) {
  const className = `chip chip--${size}`

  if (onClick) {
    return (
      <button type="button" class={className} aria-pressed={pressed} onClick={onClick}>
        {label}
      </button>
    )
  }

  return (
    <span class={onRemove ? `${className} chip--removable` : className}>
      {label}
      {onRemove && (
        <button
          type="button"
          class="chip__remove"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="10"
            height="10"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </span>
  )
}
