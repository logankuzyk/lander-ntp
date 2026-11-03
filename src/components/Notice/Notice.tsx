import { useEffect, useRef, useState } from 'preact/hooks'

import { CloseIcon } from '@/components/Popover/CloseIcon'

type NoticeProps = {
  /** The one thing to do about it, such as Undo. Beside the line, before the Dismiss. */
  action?: { label: string; onClick: () => void }
  /**
   * Goes by itself, as if dismissed, after this many milliseconds, which are not counted while
   * the pointer is over the line or focus is in it, so it is never taken from someone who is
   * reaching for it.
   */
  autoDismissMs?: number
  /**
   * Which notice this is, when one with the same words follows another: it starts its time again.
   * By default the words tell them apart.
   */
  identity?: string
  /** What to say, or null for nothing. */
  message: string | null
  onDismiss: () => void
}

/**
 * One short line in the callouts' look, fixed above the bottom bar: a thing the page has to
 * say that nobody has to answer, such as a change it could not save, or that it can take back,
 * such as a Widget just removed. It has a Dismiss, and at most one other button, the `action`.
 * The page decides when it goes, or says how long it stays (`autoDismissMs`).
 *
 * The live region is always on the page, empty until there is something to say: a screen reader
 * announces text that arrives in a region it already knows, and often misses a region that
 * arrives with its text. The line comes first in it, then the buttons.
 */
export function Notice({ action, autoDismissMs, identity, message, onDismiss }: NoticeProps) {
  return (
    <div class="notice" role="status">
      {message !== null && (
        <Line
          action={action}
          autoDismissMs={autoDismissMs}
          key={identity ?? message}
          message={message}
          onDismiss={onDismiss}
        />
      )}
    </div>
  )
}

function Line({
  action,
  autoDismissMs,
  message,
  onDismiss,
}: Omit<NoticeProps, 'identity'> & { message: string }) {
  const line = useRef<HTMLDivElement>(null)
  // Whatever had focus when the line came: where the person was working.
  const [before] = useState(() => document.activeElement)

  // Taking away what has focus drops focus to the page. If it was on the Dismiss, whether it
  // was pressed or the line timed out, hand it back to where the person was.
  useEffect(
    () => () => {
      if (
        line.current?.contains(document.activeElement) &&
        before instanceof HTMLElement &&
        before.isConnected
      ) {
        before.focus()
      }
    },
    [before],
  )

  // The time left, which only runs while nothing is over the line or focused in it.
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const held = hovered || focused
  const left = useRef(autoDismissMs)
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss
  useEffect(() => {
    if (autoDismissMs === undefined || held) return
    const started = Date.now()
    const timer = setTimeout(() => dismiss.current(), left.current)
    return () => {
      clearTimeout(timer)
      left.current = (left.current ?? 0) - (Date.now() - started)
    }
  }, [autoDismissMs, held])

  return (
    <div
      class={action ? 'callout callout--notice callout--has-action' : 'callout callout--notice'}
      onFocusIn={() => setFocused(true)}
      onFocusOut={() => setFocused(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      ref={line}
    >
      <div class="callout__header">
        <span>{message}</span>
        {action && (
          <button class="callout__action" onClick={action.onClick} type="button">
            {action.label}
          </button>
        )}
        <button aria-label="Dismiss" class="popover__close" onClick={onDismiss} type="button">
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
