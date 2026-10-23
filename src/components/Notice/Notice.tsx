import { CloseIcon } from '@/components/Popover/CloseIcon'

type NoticeProps = {
  message: string
  onDismiss: () => void
}

/**
 * One short line in the callouts' look, fixed above the bottom bar: a thing the page has to
 * say that nobody has to answer, such as a change it could not save. It has a Dismiss and no
 * other button. The page decides when it goes.
 */
export function Notice({ message, onDismiss }: NoticeProps) {
  return (
    <div class="callout callout--notice" role="status">
      <div class="callout__header">
        <span>{message}</span>
        <button aria-label="Dismiss" class="popover__close" onClick={onDismiss} type="button">
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
