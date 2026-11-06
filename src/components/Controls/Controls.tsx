import { useEffect, useState } from 'preact/hooks'

import { AddMenu } from '@/components/AddMenu/AddMenu'
import { useEditMode } from '@/components/EditMode/useEditMode'
import type { Layout } from '@/layout/types'

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))

/**
 * Keys pressed inside a popover belong to it: arrows move between its tabs and chips. Likewise
 * the welcome, which is a modal: nothing behind it should answer.
 */
const inPopover = (target: EventTarget | null) =>
  target instanceof Element && target.closest('.popover, dialog, [role="menu"]') !== null

type ControlsProps = {
  /** True while the photo being faded in is still loading. */
  busy?: boolean
  infoOpen?: boolean
  /** The Layout, which the Add menu adds to. */
  layout: Layout
  /** Whether the stored Layout has arrived: until it has, nothing can be added. */
  layoutLoaded: boolean
  /** Saves the whole Layout (`useLayout`'s `commit`). */
  onCommit: (next: Layout) => void
  onNext: () => void
  /** Omitted when the photo details widget is switched off. */
  onToggleInfo?: () => void
  onToggleSettings: () => void
  settingsOpen?: boolean
}

/**
 * Bottom-right controls. The → and i keys do the same as the buttons, E does what the Edit
 * button does, and A opens the Add menu while editing. Escape leaves edit mode, but not when
 * something else used it first: a menu, a popover or a dropdown closes on its Escape, ahead of
 * this listener, so the innermost thing goes first.
 */
export function Controls({
  busy,
  infoOpen,
  layout,
  layoutLoaded,
  onCommit,
  onNext,
  onToggleInfo,
  onToggleSettings,
  settingsOpen,
}: ControlsProps) {
  const { canChange, editing, enter, leave } = useEditMode()
  const [addOpen, setAddOpen] = useState(false)

  // Edit mode ending takes the menu with it, so the next time it starts the menu is shut.
  useEffect(() => {
    if (!editing) setAddOpen(false)
  }, [editing])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditable(event.target) ||
        inPopover(event.target)
      ) {
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (!busy) onNext()
      } else if (event.key === 'i' && onToggleInfo) {
        event.preventDefault()
        onToggleInfo()
      } else if (event.key === 'e' && !event.repeat) {
        // Not a held key's repeats: they would switch it on and off as long as it is down.
        event.preventDefault()
        if (editing) leave()
        else enter()
      } else if (event.key === 'a' && editing && !event.repeat) {
        event.preventDefault()
        setAddOpen(true)
      } else if (event.key === 'Escape' && editing) {
        event.preventDefault()
        leave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onNext, busy, onToggleInfo, editing, enter, leave])

  return (
    <div class="controls">
      {/*
        Add comes first while editing, beside Done and to its left, so that Done keeps the place
        Edit had and the buttons that were already here stay put. */}
      {editing && (
        <AddMenu
          layout={layout}
          loaded={layoutLoaded}
          onCommit={onCommit}
          onOpenChange={setAddOpen}
          open={addOpen}
        />
      )}
      {/*
        Before the buttons that were already here, so that they stay put when this one reads Done
        and gets wider. It is one button throughout, so focus stays on it when it changes. The name
        changes with the words, so that what is said is what is seen; aria-pressed says it is on.
      */}
      <button
        aria-label={editing ? 'Done' : 'Edit'}
        aria-pressed={editing}
        class={editing ? 'control control--done' : 'control'}
        // What a callout points at (see onboarding/target).
        data-callout-target="edit"
        // Where focus goes when edit mode ends with a Widget's frame focused (see useEditMode).
        data-edit-toggle
        onClick={editing ? leave : enter}
        // The settings panel's Edit button hands focus here while Enter may still be held, and a
        // browser clicks a button on every Enter keydown, repeats included: edit mode would
        // flicker. Only an Enter that went down on this button presses it.
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.repeat) event.preventDefault()
        }}
        title={editing ? 'Done (E)' : 'Edit (E)'}
        type="button"
      >
        {editing ? (
          'Done'
        ) : (
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
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        )}
      </button>
      {editing && !canChange && (
        <span class="controls__readonly">Update Lander to change this.</span>
      )}
      <button
        aria-busy={busy === true}
        aria-label="Next photo"
        class={busy ? 'control control--busy' : 'control'}
        // Ignored rather than disabled while the next photo loads: each press would stack
        // another full-resolution image over the one the wait is already for. The button
        // keeps its place in the Tab order so focus does not jump away mid-press.
        onClick={busy ? undefined : onNext}
        title="Next photo (→)"
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
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
      {onToggleInfo && (
        <button
          aria-expanded={infoOpen === true}
          aria-label="Photo details"
          class="control"
          // Opens and closes the popover itself, so pressing it isn't a click outside.
          data-popover-toggle
          onClick={onToggleInfo}
          title="Photo details (i)"
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
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
          </svg>
        </button>
      )}
      <button
        aria-expanded={settingsOpen === true}
        aria-label="Settings"
        class="control"
        data-popover-toggle
        onClick={onToggleSettings}
        title="Settings"
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
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  )
}
