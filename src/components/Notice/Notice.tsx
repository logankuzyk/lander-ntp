import { useEffect, useRef, useState } from 'preact/hooks'

import { CloseIcon } from '@/components/Popover/CloseIcon'

type NoticeProps = {
  /** What to say, or null for nothing. */
  message: string | null
  onDismiss: () => void
}

/**
 * One short line in the callouts' look, fixed above the bottom bar: a thing the page has to
 * say that nobody has to answer, such as a change it could not save. It has a Dismiss and no
 * other button. The page decides when it goes.
 *
 * The live region is always on the page, empty until there is something to say: a screen reader
 * announces text that arrives in a region it already knows, and often misses a region that
 * arrives with its text.
 */
export function Notice({ message, onDismiss }: NoticeProps) {
  return (
    <div class="notice" role="status">
      {message !== null && <Line message={message} onDismiss={onDismiss} />}
    </div>
  )
}

function Line({ message, onDismiss }: Required<NoticeProps>) {
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

  return (
    <div class="callout callout--notice" ref={line}>
      <div class="callout__header">
        <span>{message}</span>
        <button aria-label="Dismiss" class="popover__close" onClick={onDismiss} type="button">
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
