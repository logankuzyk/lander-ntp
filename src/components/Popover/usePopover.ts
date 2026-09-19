import { useEffect, useRef } from 'preact/hooks'

/**
 * Focus and Escape handling shared by the bottom-right popovers. Focus moves to the close
 * button on open and back to whatever opened the popover on close, unless it has already
 * moved somewhere else, such as the button for the other popover.
 */
export function usePopover(onClose: () => void) {
  const container = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement
    const dialog = container.current
    close.current?.focus()
    return () => {
      const focused = document.activeElement
      const stillHere = !focused || focused === document.body || dialog?.contains(focused)
      if (stillHere && opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return { container, close }
}
