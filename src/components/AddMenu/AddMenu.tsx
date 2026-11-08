import { useEffect, useId, useRef, useState } from 'preact/hooks'

import { useEditMode } from '@/components/EditMode/useEditMode'
import { addWidget } from '@/layout/ops'
import type { Layout } from '@/layout/types'
import { MARKS } from '@/onboarding/callouts'
import { NewMark } from '@/onboarding/NewMark'
import { onboardingItem } from '@/onboarding/storage'
import { recordSeen } from '@/onboarding/useSeen'
import { widgetBox } from '@/widgetSystem/focusBox'
import { WIDGETS } from '@/widgetSystem/registry'

import { type ItemState, itemState, menuNote } from './availability'

type AddMenuProps = {
  /**
   * Whether opening the menu puts focus on its first item (it does, unless the tour opened it
   * and its Next button is to keep focus).
   */
  focusOnOpen?: boolean
  /** The Layout, as `useLayout` gives it. */
  layout: Layout
  /** Whether the stored Layout has arrived: until it has, nothing is added (see `useLayout`). */
  loaded: boolean
  /** Saves the whole Layout (`useLayout`'s `commit`): once for each Widget added. */
  onCommit: (next: Layout) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}

/**
 * How long "Weather added." stays in the live region, and how long an add is watched for its save
 * being rejected (which takes the Widget away again).
 */
const SAID_MS = 3_000

/**
 * A live region says what changes, so the same words again are silent. Every second line has this
 * (it is read as nothing) on its end, so a second add at once is a change.
 */
const ZERO_WIDTH_SPACE = '\u200B'

const ITEM = '[role="menuitem"]'

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
export function AddMenu({
  focusOnOpen = true,
  layout,
  loaded,
  onCommit,
  onOpenChange,
  open,
}: AddMenuProps) {
  const { canChange } = useEditMode()
  const titleId = useId()
  const noteId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [said, setSaid] = useState<{ n: number; text: string } | null>(null)
  const [newMarks, setNewMarks] = useState<ReadonlySet<string>>(new Set())
  // The Widget just added, until its line has gone; `seen` once the Layout has had it.
  const added = useRef<{ id: string; seen: boolean } | null>(null)

  const editable = { layout, readOnly: !canChange || !loaded }
  // Only a known newer Layout gets the update message; before it loads, the items stay off but
  // the page must not claim that an update is needed.
  const note = menuNote({ layout, readOnly: !canChange })

  // Into the menu on open: the first item, whether it can be picked or not (its reason is read).
  useEffect(() => {
    if (open && focusOnOpen) menu.current?.querySelector<HTMLElement>(ITEM)?.focus()
    // Only when it opens: `focusOnOpen` changing under an open menu is not a reason to move focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) {
      setNewMarks(new Set())
      return
    }
    let active = true
    const ids = MARKS.filter((id) => id === 'clock' || id === 'weather-widget')
    void onboardingItem.getValue().then(async (record) => {
      if (!active || !record) return
      const unseen = ids.filter((id) => !record.dismissed.includes(id))
      setNewMarks(new Set(unseen))
      await recordSeen(unseen)
    })
    return () => {
      active = false
    }
  }, [open])

  // A press elsewhere closes it. The button toggles it itself.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menu.current?.contains(target) || button.current?.contains(target)) return
      // A note beside the menu (the tour's, which opens it) is the page's own: pressing it must
      // not take the menu away, as the note goes with the thing it is beside, from under the
      // pointer, before the click arrives.
      if (target instanceof Element && target.closest('.callout')) return
      onOpenChange(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, onOpenChange])

  // The new Widget is in the document once the Layout has been drawn with it: focus goes to its
  // frame. If it cannot be found, to the button, so that focus is not left on the page. If the
  // save is then rejected the Layout goes back without it, and so does what was said: focus goes
  // to the button if it was on the frame that has gone.
  useEffect(() => {
    const watched = added.current
    if (watched === null) return
    const present = layout.widgets.some(
      (widget) => widget.kind !== 'malformed' && widget.placed.id === watched.id,
    )
    if (!watched.seen) {
      if (!present) return
      watched.seen = true
      ;(widgetBox(watched.id) ?? button.current)?.focus()
    } else if (!present) {
      added.current = null
      setSaid(null)
      const focused = document.activeElement
      if (!focused || focused === document.body || !focused.isConnected) button.current?.focus()
    }
  }, [layout])

  useEffect(() => {
    if (said === null) return
    const timer = setTimeout(() => {
      added.current = null
      setSaid(null)
    }, SAID_MS)
    return () => clearTimeout(timer)
  }, [said])

  const pick = (type: string, name: string) => {
    const result = addWidget(editable, type)
    if (!result.ok) return
    onOpenChange(false)
    added.current = { id: result.id, seen: false }
    onCommit(result.layout)
    setSaid((was) => ({ n: (was?.n ?? 0) + 1, text: `${name} added.` }))
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
                marked={newMarks.has(type === 'weather' ? 'weather-widget' : type)}
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
        {said && said.text + (said.n % 2 === 0 ? ZERO_WIDTH_SPACE : '')}
      </p>
    </div>
  )
}

function MenuItem({
  marked,
  name,
  onPick,
  state,
  type,
}: {
  marked: boolean
  name: string
  onPick: () => void
  state: ItemState
  type: string
}) {
  const reason = state.available ? null : state.reason
  return (
    <button
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
      <span>
        {name}
        {marked && <NewMark />}
      </span>
      {reason !== null && <span class="add-menu__reason">{reason}</span>}
    </button>
  )
}
