import { useEffect, useRef } from 'preact/hooks'

type PopoverOptions = {
  /**
   * Leaves focus where it is when the popover appears, for one whose contents take it themselves
   * (the options popover puts it on the first option). By default it moves to the close button.
   */
  keepFocus?: boolean
  /**
   * Where focus goes on closing, instead of whatever had it when the popover opened: the
   * options popover gives it back to the Widget it belongs to, not to the button that opened it.
   */
  returnTo?: () => HTMLElement | null
}

/**
 * Focus and closing shared by the popovers. Focus moves to the close button on open and back to
 * whatever opened the popover on close, unless it has already moved somewhere else, such as the
 * button for the other popover. Escape and a click outside close it.
 */
export function usePopover(
  onClose: () => void,
  { keepFocus = false, returnTo }: PopoverOptions = {},
) {
  const container = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  // Read when the popover closes, so it is the latest.
  const returning = useRef(returnTo)
  returning.current = returnTo

  useEffect(() => {
    const opener = document.activeElement
    const dialog = container.current
    if (!keepFocus) close.current?.focus()
    return () => {
      const focused = document.activeElement
      const stillHere = !focused || focused === document.body || dialog?.contains(focused)
      const target = returning.current ? returning.current() : opener
      if (stillHere && target instanceof HTMLElement) target.focus()
    }
    // Only as it appears and goes: `keepFocus` is a fact about the popover, not a setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A dropdown inside handles its own Escape first.
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      onClose()
    }
    // On press rather than click, so a drag that starts inside (selecting text, say) and ends
    // outside doesn't close it.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (
        !(target instanceof Element) ||
        container.current?.contains(target) ||
        target.closest('.callout')
      )
        return
      // Toggles close the popover themselves; closing it here too would open it again.
      if (target.closest('[data-popover-toggle]')) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [onClose])

  return { close, container }
}
