import type { ComponentChildren } from 'preact'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks'

/** Between the field and the menu, and the menu and the window's edge. */
const GAP = 4
const EDGE = 8
/** Enough room below for a few options, which is where a menu is looked for first. */
const ROOM_BELOW = 200

const OPTION = '[role="option"]'

type DropdownProps = {
  /** Id of the visible label, which names the field and its menu. */
  labelId: string
  /** What the closed field shows. */
  value: ComponentChildren
  /** `listbox` when the menu is only options; `dialog` when it has other controls as well. */
  popup: 'listbox' | 'dialog'
  /** For a field that holds chips rather than a line of text. */
  chips?: boolean
  /** The menu's contents. `close` shuts it and puts focus back on the field. */
  children: (close: () => void) => ComponentChildren
}

/**
 * A field that opens a menu under it (or over it, when there's more room there). The menu is
 * positioned against the popover rather than the scrolling section, so the section can't clip
 * it. Arrow keys move between options, and Escape, a click outside or tabbing away close it.
 * Select and MultiSelect fill it in.
 */
export function Dropdown({ labelId, value, popup, chips = false, children }: DropdownProps) {
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const field = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  /** Which option last had focus, to land near it when a choice removes that option. */
  const lastOption = useRef(0)

  const close = useCallback(() => {
    setOpen(false)
    field.current?.focus()
  }, [])

  const options = () => [...(menu.current?.querySelectorAll<HTMLElement>(OPTION) ?? [])]

  // Placement: right edges together, below the field when it fits there or there's a fair bit
  // of room to scroll in, otherwise wherever there's more.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = field.current
      const el = menu.current
      if (!anchor || !el) return
      const frame = (el.offsetParent ?? document.documentElement).getBoundingClientRect()
      const at = anchor.getBoundingClientRect()
      const below = window.innerHeight - at.bottom - GAP - EDGE
      const above = at.top - GAP - EDGE
      const up = el.scrollHeight > below && below < ROOM_BELOW && above > below
      el.style.right = `${frame.right - at.right}px`
      el.style.top = up ? '' : `${at.bottom - frame.top + GAP}px`
      el.style.bottom = up ? `${frame.bottom - at.top + GAP}px` : ''
      el.style.maxHeight = `${Math.max(up ? above : below, 0)}px`
      el.style.minWidth = `${at.width}px`
    }
    place()
    window.addEventListener('resize', place)
    // Capture: the section that scrolls is an ancestor, not the window.
    document.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      document.removeEventListener('scroll', place, true)
    }
  }, [open])

  // Into the menu on open: the chosen option, else the first one, else whatever can take it.
  useEffect(() => {
    if (!open) return
    const el = menu.current
    const target =
      el?.querySelector<HTMLElement>(`${OPTION}[aria-selected="true"]`) ??
      el?.querySelector<HTMLElement>(OPTION) ??
      el?.querySelector<HTMLElement>('button')
    target?.focus()
  }, [open])

  // Keep focus in the menu when a choice removes the focused option (a multi-select adding a
  // tag, say): land on the option now in its place.
  useLayoutEffect(() => {
    if (!open) return
    // Only when focus has dropped to the page; anywhere else it went on purpose.
    const focused = document.activeElement
    if (focused && focused !== document.body) return
    const list = options()
    const target = list[Math.min(lastOption.current, list.length - 1)]
    ;(target ?? menu.current?.querySelector<HTMLElement>('button'))?.focus()
  })

  // A press outside closes it. The field toggles it itself.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menu.current?.contains(target) || field.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onFieldKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
    }
  }

  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Only the menu: the popover it sits in stays open.
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    const list = options()
    const index = list.indexOf(document.activeElement as HTMLElement)
    const to = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: list.length - 1,
    }[event.key]
    if (to === undefined || list.length === 0) return
    event.preventDefault()
    list[Math.max(0, Math.min(to, list.length - 1))]?.focus()
  }

  const onMenuFocusIn = (event: FocusEvent) => {
    const index = options().indexOf(event.target as HTMLElement)
    if (index >= 0) lastOption.current = index
  }

  // Tabbing out of the menu closes it, but not a click that removes the focused option.
  const onMenuFocusOut = (event: FocusEvent) => {
    const to = event.relatedTarget
    if (!(to instanceof Node)) return
    if (menu.current?.contains(to) || field.current?.contains(to)) return
    setOpen(false)
  }

  return (
    <div class="dropdown">
      <button
        ref={field}
        type="button"
        role="combobox"
        class={chips ? 'dropdown__field dropdown__field--chips' : 'dropdown__field'}
        aria-labelledby={labelId}
        aria-haspopup={popup}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={onFieldKeyDown}
      >
        <span class="dropdown__value">{value}</span>
        <svg
          class="dropdown__chevron"
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          class={`dropdown__menu dropdown__menu--${popup}`}
          role={popup}
          aria-labelledby={labelId}
          onKeyDown={onMenuKeyDown}
          onFocusIn={onMenuFocusIn}
          onFocusOut={onMenuFocusOut}
          // Its own scrolling: the popover shouldn't grow under it.
          onWheel={(event) => event.stopPropagation()}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}
