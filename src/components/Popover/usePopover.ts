import { useEffect, useRef } from 'preact/hooks'

/**
 * Focus and closing shared by the bottom-right popovers. Focus moves to the close button on
 * open and back to whatever opened the popover on close, unless it has already moved somewhere
 * else, such as the button for the other popover. Escape and a click outside close it.
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
      // A dropdown inside handles its own Escape first.
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      onClose()
    }
    // On press rather than click, so a drag that starts inside (selecting text, say) and ends
    // outside doesn't close it.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element) || container.current?.contains(target)) return
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

  return { container, close }
}
