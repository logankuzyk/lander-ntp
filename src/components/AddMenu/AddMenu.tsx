import { useEffect, useId, useRef, useState } from 'preact/hooks'

import { useEditMode } from '@/components/EditMode/useEditMode'
import { addWidget } from '@/layout/ops'
import type { Layout } from '@/layout/types'
import { WIDGETS } from '@/widgetSystem/registry'

import { type ItemState, itemState, menuNote } from './availability'

type AddMenuProps = {
  /** The Layout, as `useLayout` gives it. */
  layout: Layout
  /** Whether the stored Layout has arrived: until it has, nothing is added (see `useLayout`). */
  loaded: boolean
  /** Saves the whole Layout (`useLayout`'s `commit`): once for each Widget added. */
  onCommit: (next: Layout) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}

/** How long "Weather added." stays in the live region, so the same words can be said again. */
const SAID_MS = 3_000

const ITEM = '[role="menuitem"]'

/** The Widget's box on the page, by the id it is stored under. */
const boxOf = (id: string) =>
  [...document.querySelectorAll<HTMLElement>('.widget-box')].find(
    (box) => box.dataset.widgetId === id,
  ) ?? null

/**
 * The Add button and its menu, in the Bottom bar while editing. The menu lists the registry's
 * Widgets by name: a real menu, with the arrow keys (they wrap), Home and End to move, Enter or
 * a click to pick, and Escape to close it, ahead of the popover and of edit mode. The menu's
 * state is the caller's (`open`), so that the A key can open it.
 *
 * A pick is `addWidget`: the Widget's starting size in the free place nearest the middle, or a
 * smaller size that fits, using the options an update kept for its type if any are waiting. The
 * whole Layout is committed in one save. The new Widget's frame then takes focus (a new Weather
 * shows its setup button; nothing opens by itself), and a polite live region says what was
 * added. An item with no room stays focusable but is unavailable, with the reason beside it, so
 * it is read out and does nothing when pressed. Whatever applies to the whole menu is in
 * `menuNote`, beside the title.
 */
export function AddMenu({ layout, loaded, onCommit, onOpenChange, open }: AddMenuProps) {
  const { canChange } = useEditMode()
  const titleId = useId()
  const noteId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [said, setSaid] = useState('')
  const pending = useRef<string | null>(null)

  const editable = { layout, readOnly: !canChange || !loaded }
  const note = menuNote(editable)

  // Into the menu on open: the first item, whether it can be picked or not (its reason is read).
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>(ITEM)?.focus()
  }, [open])

  // A press elsewhere closes it. The button toggles it itself.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menu.current?.contains(target) || button.current?.contains(target)) return
      onOpenChange(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, onOpenChange])

  // The new Widget is in the document once the Layout has been drawn with it: focus goes to its
  // frame. If it cannot be found, to the button, so that focus is not left on the page.
  useEffect(() => {
    const id = pending.current
    if (id === null) return
    pending.current = null
    ;(boxOf(id) ?? button.current)?.focus()
  }, [layout])

  useEffect(() => {
    if (said === '') return
    const timer = setTimeout(() => setSaid(''), SAID_MS)
    return () => clearTimeout(timer)
  }, [said])

  const pick = (type: string, name: string) => {
    const added = addWidget(editable, type)
    if (!added.ok) return
    onOpenChange(false)
    pending.current = added.id
    onCommit(added.layout)
    setSaid(`${name} added.`)
  }

  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Only the menu: a popover behind it, and edit mode, stay as they are.
      event.preventDefault()
      event.stopPropagation()
      onOpenChange(false)
      button.current?.focus()
      return
    }
    const list = [...(menu.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])]
    if (list.length === 0) return
    const index = list.indexOf(document.activeElement as HTMLElement)
    const to = {
      ArrowDown: (index + 1) % list.length,
      ArrowUp: (index - 1 + list.length) % list.length,
      End: list.length - 1,
      Home: 0,
    }[event.key]
    if (to === undefined) return
    event.preventDefault()
    list[to]?.focus()
  }

  // Tabbing out of the menu closes it.
  const onMenuFocusOut = (event: FocusEvent) => {
    const to = event.relatedTarget
    if (!(to instanceof Node)) return
    if (menu.current?.contains(to) || button.current?.contains(to)) return
    onOpenChange(false)
  }

  return (
    <div class="add">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Add"
        class="control"
        // What a callout points at (see onboarding/target).
        data-callout-target="add"
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            onOpenChange(true)
          }
        }}
        ref={button}
        title="Add (A)"
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {open && (
        <div class="add-menu" onFocusOut={onMenuFocusOut}>
          <div class="add-menu__header">
            <span class="add-menu__title" id={titleId}>
              Add a widget
            </span>
            {note !== null && (
              <span class="add-menu__note" id={noteId}>
                {note}
              </span>
            )}
          </div>
          <div
            aria-describedby={note !== null ? noteId : undefined}
            aria-labelledby={titleId}
            class="add-menu__items"
            onKeyDown={onMenuKeyDown}
            ref={menu}
            role="menu"
            tabIndex={-1}
          >
            {WIDGETS.map(({ name, type }) => (
              <MenuItem
                key={type}
                name={name}
                onPick={() => pick(type, name)}
                state={itemState(editable, type, name, note)}
                type={type}
              />
            ))}
          </div>
        </div>
      )}
      {/* Said when a Widget is added, to people who cannot see it appear. Always on the page. */}
      <p aria-live="polite" class="visually-hidden">
        {said}
      </p>
    </div>
  )
}

function MenuItem({
  name,
  onPick,
  state,
  type,
}: {
  name: string
  onPick: () => void
  state: ItemState
  type: string
}) {
  const reasonId = useId()
  const reason = state.available ? null : state.reason
  return (
    <button
      aria-describedby={reason !== null ? reasonId : undefined}
      // Not `disabled`: it stays a stop for focus, so that its reason is read out.
      aria-disabled={state.available ? undefined : true}
      class="add-menu__item"
      // What a callout points at (see onboarding/target).
      data-callout-target={`menu:${type}`}
      onClick={state.available ? onPick : undefined}
      role="menuitem"
      tabIndex={-1}
      type="button"
    >
      <span>{name}</span>
      {reason !== null && (
        <span class="add-menu__reason" id={reasonId}>
          {reason}
        </span>
      )}
    </button>
  )
}
