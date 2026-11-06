import { useEffect, useLayoutEffect, useRef } from 'preact/hooks'

import { READ_ONLY_UPDATE_NOTE } from '@/components/EditMode/copy'
import { CloseIcon } from '@/components/Popover/CloseIcon'
import { usePopover } from '@/components/Popover/usePopover'

import type { PageValueName, PageValues } from './definition'
import { focusBox } from './focusBox'
import { OptionsForm } from './OptionsForm'
import { placeBeside } from './placeBeside'
import type { AnyWidgetDefinition } from './registry'

type OptionsPopoverProps = {
  /** The Widget's box on the page, which the popover sits beside and gives focus back to. */
  box: () => HTMLElement | null
  definition: AnyWidgetDefinition
  /** Shows the options and changes none: for a Layout that may not be changed. */
  disabled?: boolean
  /** The option to put focus on, where the first is not the one wanted (a setup button's). */
  focusOption?: string
  /**
   * What the Widget's box is called to a reader (see `accessibleName`: "Weather, Victoria"), which
   * names the dialog and its heading, so two of one type are told apart as their boxes are.
   */
  name: string
  /** The Widget's whole options, with the change made: see `OptionsForm`. */
  onChange: (options: Record<string, unknown>) => void
  onClose: () => void
  onPageValueChange: <N extends PageValueName>(name: N, value: PageValues[N]) => void
  /** What is stored for the Widget. */
  options: unknown
  page: PageValues
  /** Whether the settings that own page-wide values may be changed. */
  pageValuesDisabled?: boolean
  /** Shows the reason the Widget's options cannot be changed. */
  readOnly?: boolean
}

/**
 * A Widget's options, in a non-modal dialog beside its box, so that the Widget stays in view
 * while it changes (see `placeBeside`). One column; it scrolls inside only when the window is
 * too short to hold it. It is the form (`OptionsForm`) and nothing else: whoever draws it saves
 * the changes, as they are made.
 *
 * Focus goes to the first option on opening and back to the Widget on closing. Escape, the ×
 * and a press elsewhere close it (see `usePopover`); it is a `.popover`, so the page's keys (E,
 * the arrows) are not heard inside it. The Widget's Options button is a `data-popover-toggle`,
 * which is how a press on it is not "elsewhere".
 */
export function OptionsPopover({
  box,
  definition,
  disabled = false,
  focusOption,
  name,
  onChange,
  onClose,
  onPageValueChange,
  options,
  page,
  pageValuesDisabled = disabled,
  readOnly = false,
}: OptionsPopoverProps) {
  const title = `${name} options`
  // Focus goes back to the Widget's setup button if it is still there (it opened this, or there
  // is something left to set up), and else to the Widget's box.
  const { close, container } = usePopover(onClose, {
    keepFocus: true,
    returnTo: () => {
      const widget = box()
      const button = widget?.querySelector<HTMLElement>('.widget-setup')
      if (button || !widget) return button ?? widget
      // Only gives the box focus, and takes that back when focus moves on (see `focusBox`).
      return focusBox(widget)
    },
  })
  const form = useRef<HTMLDivElement>(null)

  // Against the Widget's box: measured at its natural size, then put beside it, before it is
  // painted. After every render, as the Widget can have moved (another tab changed the Layout).
  const place = () => {
    const popover = container.current
    const anchor = box()
    if (!popover || !anchor) return
    popover.style.maxHeight = ''
    const placement = placeBeside(
      anchor.getBoundingClientRect(),
      { height: popover.offsetHeight, width: popover.offsetWidth },
      { height: window.innerHeight, width: window.innerWidth },
    )
    popover.style.left = `${placement.left}px`
    popover.style.top = `${placement.top}px`
    popover.style.maxHeight = `${placement.maxHeight}px`
    popover.dataset.side = placement.side
  }
  useLayoutEffect(place)

  // And again when the window changes size, or the form does (a list opens in it).
  const placing = useRef(place)
  placing.current = place
  useEffect(() => {
    const again = () => placing.current()
    window.addEventListener('resize', again)
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(again)
    // The form, not the body that scrolls it: the form's size is the contents', whatever room it has.
    const contents = form.current?.firstElementChild
    if (contents) watcher?.observe(contents)
    return () => {
      window.removeEventListener('resize', again)
      watcher?.disconnect()
    }
  }, [])

  // The form takes focus itself; when it has nothing to take it (all of it is off), the ×.
  useEffect(() => {
    if (!container.current?.contains(document.activeElement)) close.current?.focus()
  }, [close, container])

  return (
    <aside aria-label={title} class="popover options-popover" ref={container} role="dialog">
      <header class="popover__header">
        <h2>{title}</h2>
        <button
          aria-label={`Close ${title}`}
          class="popover__close"
          onClick={onClose}
          ref={close}
          type="button"
        >
          <CloseIcon />
        </button>
      </header>
      <div class="options-popover__body" ref={form}>
        {readOnly && (
          <p class="settings__note options-popover__readonly">{READ_ONLY_UPDATE_NOTE}</p>
        )}
        <OptionsForm
          definition={definition}
          disabled={disabled}
          focusOption={focusOption ?? definition.options[0]?.id}
          onChange={onChange}
          onPageValueChange={onPageValueChange}
          options={options}
          page={page}
          pageValuesDisabled={pageValuesDisabled}
        />
      </div>
    </aside>
  )
}
