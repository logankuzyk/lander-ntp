import type { RefObject } from 'preact'
import { useLayoutEffect } from 'preact/hooks'

/** Between the anchor and the menu, and the menu and the window's edge. */
const GAP = 4
const EDGE = 8
/** Enough room below for a few options, which is where a menu is looked for first. */
const ROOM_BELOW = 200

/**
 * Keep an open menu against its anchor: below it when it fits there or there's a fair bit of
 * room to scroll in, otherwise wherever there's more. The menu is positioned against the
 * popover rather than the scrolling section, so the section can't clip it. `end` puts their
 * right edges together, the menu at least as wide as the anchor; `fill` makes it the anchor's
 * width. `moved` is anything else that moves the anchor while the menu is open.
 */
export function usePlacement(
  open: boolean,
  anchor: RefObject<HTMLElement>,
  menu: RefObject<HTMLElement>,
  align: 'end' | 'fill',
  moved?: unknown,
) {
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const el = menu.current
      if (!anchor.current || !el) return
      const frame = (el.offsetParent ?? document.documentElement).getBoundingClientRect()
      const at = anchor.current.getBoundingClientRect()
      const below = window.innerHeight - at.bottom - GAP - EDGE
      const above = at.top - GAP - EDGE
      const up = el.scrollHeight > below && below < ROOM_BELOW && above > below
      el.style.right = `${frame.right - at.right}px`
      el.style.top = up ? '' : `${at.bottom - frame.top + GAP}px`
      el.style.bottom = up ? `${frame.bottom - at.top + GAP}px` : ''
      el.style.maxHeight = `${Math.max(up ? above : below, 0)}px`
      el.style[align === 'fill' ? 'width' : 'minWidth'] = `${at.width}px`
    }
    place()
    window.addEventListener('resize', place)
    // Capture: the section that scrolls is an ancestor, not the window.
    document.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      document.removeEventListener('scroll', place, true)
    }
  }, [open, anchor, menu, align, moved])
}
