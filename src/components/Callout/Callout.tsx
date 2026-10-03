import { CloseIcon } from '@/components/Popover/CloseIcon'
import { useLeave } from '@/onboarding/useLeave'

type CalloutProps = {
  /** The one thing to do about it: move on, or go and set it up. */
  action: { label: string; onClick: () => void }
  body: string
  /** Where it sits: see the `callout--` modifiers in style.css. */
  class?: string
  onDismiss: () => void
  /** Where this is in a run of them, e.g. "2 of 4". */
  progress?: string
  title: string
}

/**
 * A small note pointing something out: a stop on the welcome tour, or news of a feature. It
 * fades in, and fades out before either button does its work.
 */
export function Callout({
  action,
  body,
  class: placement,
  onDismiss,
  progress,
  title,
}: CalloutProps) {
  const { leave, leaving } = useLeave()
  const classes = ['callout', placement, leaving && 'callout--leaving'].filter(Boolean).join(' ')

  return (
    <div class={classes} role="note">
      <div class="callout__header">
        <strong>{title}</strong>
        <button
          aria-label="Dismiss"
          class="popover__close"
          onClick={() => leave(onDismiss)}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>
      <p>{body}</p>
      <div class="callout__footer">
        {progress && <span class="callout__progress">{progress}</span>}
        <button class="callout__action" onClick={() => leave(action.onClick)} type="button">
          {action.label}
        </button>
      </div>
    </div>
  )
}
