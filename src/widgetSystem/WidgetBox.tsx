import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

import { useEditMode } from '@/components/EditMode/useEditMode'
import type { Rect } from '@/layout/geometry'

import type {
  PageValues,
  StateMessages,
  WidgetDefinition,
  WidgetSource,
  WidgetViewProps,
} from './definition'
import { accessibleName } from './name'
import { CHECKING, recheckAll, useRecheck, useUnmetNeed } from './needs'
import { readOptions } from './options'
import { hasSetup, SetupButton, type SetupNeed } from './SetupButton'
import { useSourceState } from './source'
import { useOptionsPopover } from './useOptionsPopover'
import { useRemoval } from './useRemoval'
import { WidgetState } from './WidgetState'

type WidgetBoxProps<O, R, C> = {
  definition: WidgetDefinition<O, R, C>
  /** The id it is stored under, which its Options button opens its options by. */
  id?: string
  /** What is stored for this Widget, which may be missing or wrong; the definition reads it. */
  options: unknown
  page: PageValues
  /** The cells the Widget is drawn in: as the Grid says, not as stored. */
  rect: Rect
}

/** O on its own: not a held key, and not with a modifier (those are the browser's). */
const isOptionsKey = (event: KeyboardEvent) =>
  event.key === 'o' &&
  !event.repeat &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.shiftKey

/** Delete, or Backspace, which is what a Mac calls the Delete key: not held, not with a modifier. */
const isRemoveKey = (event: KeyboardEvent) =>
  (event.key === 'Delete' || event.key === 'Backspace') &&
  !event.repeat &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.shiftKey

/**
 * The box a Widget sits in, on the Grid: the cells of its place, a size container for the
 * Widget to lay itself out in (see `.widget-box` in the page's styles), its content centred.
 * `widget` names what it holds, for a test or a rule in the styles to find it by.
 *
 * The box is a group named `name` (see `accessibleName`: "Weather, Victoria"), in and out of
 * edit mode. The name is fixed text, not a live region: a reader says it on reaching the box and
 * never when what is inside changes, such as the Clock's time. In edit mode the box is also a
 * frame, a tab stop with the name drawn in it. The boxes are in reading order in the document
 * (see Grid), which is the order Tab takes. A box given an `id` also has an Options button at
 * its top left, which opens the Widget's options in a popover beside it (see
 * `OptionsPopoverProvider`), and so does O pressed on the frame. It also has a remove button at
 * its top right, which takes the Widget out of the Layout (see `useRemovalController`), as does
 * Delete pressed on the frame.
 */
export function Box({
  children,
  id,
  name,
  optionsLabel,
  placedId,
  rect,
  removeLabel,
  widget,
}: {
  children?: ComponentChildren
  /** Gives the box an Options button. Not for a Widget that has no options to open. */
  id?: string
  /** What people call it, such as "Clock" or "Weather, Victoria": read out, and drawn in edit mode. */
  name: string
  /**
   * What the Options button is called: "Weather options", the Widget's type and not its summary,
   * as the button is read inside the box's group, which has the full name. By default the box's.
   */
  optionsLabel?: string
  /** The id a box with no `id` of its own is stored under, so that it can be dragged (see Grid). */
  placedId?: string
  rect: Rect
  /** What the remove button is called, on the same terms as `optionsLabel`: "Remove Weather". */
  removeLabel?: string
  widget: string
}) {
  const { editing } = useEditMode()
  const options = useOptionsPopover()
  const removal = useRemoval()
  const optionsId = editing && options.available ? id : undefined
  const removeId = editing && removal.available ? id : undefined
  // Spread rather than written out: only while editing is the box a tab stop, and where O opens
  // the Widget's options and Delete removes it (on the frame or its own buttons: a key typed
  // into anything else is that thing's).
  const frame = editing
    ? {
        onKeyDown:
          optionsId === undefined && removeId === undefined
            ? undefined
            : (event: KeyboardEvent) => {
                const own =
                  event.target === event.currentTarget ||
                  (event.target instanceof Element &&
                    event.target.closest('.widget-box__options, .widget-box__remove') !== null)
                if (!own) return
                if (optionsId !== undefined && isOptionsKey(event)) {
                  event.preventDefault()
                  options.toggle(optionsId)
                } else if (removeId !== undefined && isRemoveKey(event)) {
                  event.preventDefault()
                  removal.remove(removeId)
                }
              },
        tabIndex: 0,
      }
    : {}
  return (
    <div
      aria-label={name}
      class="widget-box"
      // What a callout points at (see onboarding/target): a Widget by its type.
      data-callout-target={`widget:${widget}`}
      data-widget={widget}
      data-widget-id={id ?? placedId}
      role="group"
      style={{
        gridColumn: `${rect.col} / span ${rect.w}`,
        gridRow: `${rect.row} / span ${rect.h}`,
      }}
      {...frame}
    >
      {children}
      {optionsId !== undefined && (
        <button
          aria-expanded={options.openId === optionsId}
          aria-haspopup="dialog"
          aria-label={optionsLabel ?? `${name} options`}
          class="widget-box__options"
          // What a callout points at (see onboarding/target).
          data-callout-target="options"
          // Opens and closes the popover itself, so pressing it isn't a click outside.
          data-popover-toggle
          onClick={() => options.toggle(optionsId)}
          title="Options (O)"
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="14"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            viewBox="0 0 24 24"
            width="14"
          >
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </svg>
        </button>
      )}
      {removeId !== undefined && (
        <button
          aria-label={removeLabel ?? `Remove ${name}`}
          class="widget-box__remove"
          onClick={() => removal.remove(removeId)}
          title="Remove (Delete)"
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="14"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            viewBox="0 0 24 24"
            width="14"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
      {editing && (
        <span aria-hidden="true" class="widget-box__name">
          {name}
        </span>
      )}
    </div>
  )
}

/**
 * How long a Widget with no reading waits before it says it is loading. A reading is usually
 * cached, and read in a few milliseconds, so a new tab never flashes "Loading" before it.
 */
export const LOADING_DELAY_MS = 400

/** Whether the tab is in view. A tab nobody is looking at checks nothing, so waits for nothing. */
function useVisible(): boolean {
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    // It may have changed between the first render and now.
    update()
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}

/**
 * Whether `waiting` has been true for `ms` for this `token`. Starts again when it goes false
 * and again, or the token changes, so a new reading asked for waits as long as the first did.
 */
function useWaited(waiting: boolean, token: string, ms: number): boolean {
  const [waitedFor, setWaitedFor] = useState<string | null>(null)
  useEffect(() => {
    if (!waiting) {
      setWaitedFor(null)
      return
    }
    const timer = setTimeout(() => setWaitedFor(token), ms)
    return () => clearTimeout(timer)
  }, [waiting, token, ms])
  return waiting && waitedFor === token
}

type SourcedViewProps<O, R, C> = {
  messages: StateMessages | undefined
  name: string
  options: O
  page: PageValues
  source: WidgetSource<O, R, C>
  View: WidgetDefinition<O, R, C>['View']
}

/**
 * Runs the Widget's source and draws its View with the reading, or, while there is none, what
 * the box says instead: nothing for the first 400 ms of loading (a cached reading has come by
 * then), then "loading"; at once "failed" (the fetch failed and nothing cached is recent
 * enough to show) or "off" (the photo manifest switched the source off). A reading, even a stale
 * one inside the source's limit, is drawn silently. A component of its own so that none of this
 * starts before the needs are met: hooks cannot be called conditionally, but a component can be
 * left out.
 */
function SourcedView<O, R, C>({
  messages,
  name,
  options,
  page,
  source,
  View,
}: SourcedViewProps<O, R, C>) {
  const { context, query } = source.useQuery(options)
  const { reading, status } = useSourceState(source.source, query)
  // Only time in view counts: a tab opened in the background has not started loading, as far as
  // anyone can tell, and must not flash "Loading" when it is looked at.
  const visible = useVisible()
  const waited = useWaited(status === 'loading' && visible, query?.key ?? '', LOADING_DELAY_MS)
  if (status === 'ready') {
    // `ready` is a reading to show; the check keeps the types honest.
    return reading === null ? null : (
      <View context={context} options={options} page={page} reading={reading} />
    )
  }
  if (status === 'loading' && !waited) return null
  return <WidgetState messages={messages} name={name} state={status} />
}

/**
 * Draws a Widget in its box on the Grid: its View, with its options read from what is stored
 * and the page's values. The box is always there, because it is the Widget's place; what is
 * in it is nothing while its needs are first checked, and while one is unmet that has no words
 * or action; if it has them, the setup button (see `SetupButton`), in and out of edit mode. Once
 * drawn, a Widget or its button stays drawn while the needs are checked again. A Widget with a source has it run
 * once every need is met, and its View is drawn only with a reading; without one the box says
 * why (loading, failed or switched off: see `SourcedView`), in the same place and size.
 */
export function WidgetBox<O, R, C>({
  definition,
  id,
  options,
  page,
  rect,
}: WidgetBoxProps<O, R, C>) {
  return (
    <Box
      id={id}
      name={accessibleName(definition, readOptions(definition, options))}
      optionsLabel={`${definition.name} options`}
      rect={rect}
      removeLabel={`Remove ${definition.name}`}
      widget={definition.type}
    >
      <Contents definition={definition} id={id} options={options} page={page} />
    </Box>
  )
}

/** What the box last drew from its needs: the View, a setup button for a need, or nothing. */
type Drawn<O> = 'nothing' | 'view' | SetupNeed<O>

/** What goes in the box. A component of its own, so that the box does not wait for its hooks. */
function Contents<O, R, C>({
  definition,
  id,
  options,
  page,
}: Omit<WidgetBoxProps<O, R, C>, 'rect'>) {
  const { messages, name, source, View } = definition
  const read = readOptions(definition, options)
  // The needs are asked again, with the options unchanged, when a setup button has asked the
  // browser for something, by any Widget (`recheckAll`), and when the browser says a permission changed.
  const [rechecks, recheck] = useRecheck(Boolean(definition.needs?.length))
  const unmet = useUnmetNeed(definition.needs, read, rechecks)
  const popover = useOptionsPopover()

  // What was drawn stays while the needs are checked again, so an edit does not make a Widget
  // vanish and start over, and a setup button asked about does not blink or lose focus. Only an
  // answer, or a first check, changes it.
  const last = useRef<Drawn<O>>('nothing')
  const drawn: Drawn<O> =
    unmet === CHECKING
      ? last.current
      : unmet === null
        ? 'view'
        : hasSetup(unmet)
          ? unmet
          : 'nothing'
  last.current = drawn

  // When what a button asked the browser for is given and the next need is an option, the options
  // open at it at once, rather than leaving a second press for it.
  const [asked, setAsked] = useState<string | null>(null)
  const { open } = popover
  useEffect(() => {
    if (asked === null || unmet === CHECKING) return
    setAsked(null)
    if (unmet !== null && unmet.id !== asked && unmet.action?.kind === 'option' && id) {
      open(id, unmet.action.option)
    }
  }, [asked, id, open, unmet])

  if (drawn === 'nothing') return null
  if (drawn !== 'view') {
    return (
      <SetupButton
        id={id}
        name={name}
        need={drawn}
        onAsked={() => {
          setAsked(drawn.id)
          // This Widget for certain, and every other that is watching: what is allowed here
          // may be what another Widget was waiting on.
          recheck()
          recheckAll()
        }}
      />
    )
  }
  if (source) {
    return (
      <SourcedView
        messages={messages}
        name={name}
        options={read}
        page={page}
        source={source}
        View={View}
      />
    )
  }
  // No source, so no reading or context: they are the `undefined` that `R` and `C` default to.
  const props = { options: read, page } as WidgetViewProps<O, R, C>
  return <View {...props} />
}
