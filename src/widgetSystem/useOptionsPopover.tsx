import type { ComponentChildren } from 'preact'
import { createContext } from 'preact'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks'

import { useEditMode } from '@/components/EditMode/useEditMode'
import { setOptions, settle } from '@/layout/ops'
import type { Layout, PlacedWidget } from '@/layout/types'

import type { PageValueName, PageValues } from './definition'
import { widgetBox } from './focusBox'
import { accessibleName } from './name'
import { readOptions } from './options'
import { OptionsPopover } from './OptionsPopover'

/** What a Widget's box needs of the options popover: whether there is one, and how to open it. */
export type OptionsPopoverControls = {
  /** False outside a provider (a story or a test drawing a box alone): there is no popover. */
  available: boolean
  /** Closes it. */
  close: () => void
  /** Opens a Widget's options, at one option if asked (a setup button's), or moves to them. */
  open: (id: string, focusOption?: string) => void
  /** The id of the Widget whose options are open, if any. */
  openId: string | null
  /** Opens the Widget's options, or closes them if they are open. */
  toggle: (id: string) => void
}

const NONE: OptionsPopoverControls = {
  available: false,
  close: () => {},
  open: () => {},
  openId: null,
  toggle: () => {},
}

const OptionsPopoverContext = createContext<OptionsPopoverControls>(NONE)

export const useOptionsPopover = () => useContext(OptionsPopoverContext)

/** The Widget's box on the page, by the id it is stored under: found when it is needed. */
const boxOf = (id: string) => () => widgetBox(id)

/** The Widget this Layout stores under `id`, if this version can place it. */
function placedIn(layout: Layout, id: string): PlacedWidget | undefined {
  for (const widget of layout.widgets) {
    if (widget.kind !== 'malformed' && widget.placed.id === id) return widget.placed
  }
  return undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Whether two stored values are the same, whatever order an object's keys are in. */
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => same(item, b[index]))
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a)
    return (
      keys.length === Object.keys(b).length && keys.every((key) => key in b && same(a[key], b[key]))
    )
  }
  return a === b
}

type OpenOptions = {
  /** Whether it was opened in edit mode: leaving edit mode closes only what it opened. */
  editing: boolean
  focusOption?: string
  id: string
}

type OptionsPopoverProviderProps = {
  children?: ComponentChildren
  /** Saves the whole Layout (`useLayout`'s `commit`), once for each change made. */
  commit: (next: Layout) => Promise<unknown> | void
  /** The Layout, as `useLayout` gives it. */
  layout: Layout
  /** Whether the stored Layout has arrived: until it has, nothing is committed (see `useLayout`). */
  loaded: boolean
  /** The popover is about to open: the page closes what it must not be open with. */
  onOpen: () => void
  /** A page-wide value changed (the shared 24-hour switch): the page saves it with its settings. */
  onPageValueChange: <N extends PageValueName>(name: N, value: PageValues[N]) => void
  /** Something else that shares the corner (photo details, settings) is open: this closes. */
  otherOpen: boolean
  page: PageValues
  /** Whether the settings that own page-wide values may be changed. */
  pageValuesDisabled?: boolean
}

/**
 * Holds which Widget's options are open and draws them, in a popover beside the Widget. Opening
 * and closing are the page's business, so the boxes (inside `children`) ask for them through
 * `useOptionsPopover`; where a change goes is this component's:
 *
 * - A change to the Widget's options is the form's `writeOptions` result, laid over what is
 *   stored for the Widget (`setOptions`), and the whole Layout is committed in one save, which
 *   writes `sync:layout` and nothing else. The first one stores the Layout worked out from the
 *   settings, with the places Widgets are drawn at (`settle`, as every change does). A change
 *   that changes nothing is not saved. The Layout the next change starts from is the one just
 *   committed, not the one of the last render, so two changes in a row both land.
 * - A page-wide value goes to the page (`onPageValueChange`), not to the Layout.
 * - Nothing is committed before the stored Layout has arrived, or while it may not be changed
 *   (a newer version wrote it): the popover then shows the options with every control off.
 *
 * It closes on leaving edit mode if edit mode is where it was opened, when the Widget is gone
 * (another tab or device removed it), and when something else takes the corner.
 */
export function OptionsPopoverProvider({
  children,
  commit,
  layout,
  loaded,
  onOpen,
  onPageValueChange,
  otherOpen,
  page,
  pageValuesDisabled: pageValuesDisabledProp,
}: OptionsPopoverProviderProps) {
  const { canChange, editing } = useEditMode()
  const pageValuesDisabled = pageValuesDisabledProp ?? (!canChange || !loaded)
  const [opened, setOpened] = useState<OpenOptions | null>(null)

  const close = useCallback(() => setOpened(null), [])
  const onOpening = useRef(onOpen)
  onOpening.current = onOpen
  const editingNow = useRef(editing)
  editingNow.current = editing
  const open = useCallback((id: string, focusOption?: string) => {
    onOpening.current()
    setOpened({ editing: editingNow.current, focusOption, id })
  }, [])
  const openedId = opened?.id ?? null
  const toggle = useCallback(
    (id: string) => (openedId === id ? close() : open(id)),
    [close, open, openedId],
  )

  useEffect(() => {
    if (!editing && opened?.editing) close()
  }, [close, editing, opened])
  useEffect(() => {
    if (otherOpen) close()
  }, [close, otherOpen])

  // The Widget it is for, in the Layout as it is now.
  const widget = opened
    ? layout.widgets.find(
        (candidate) => candidate.kind === 'known' && candidate.placed.id === opened.id,
      )
    : undefined
  const target = widget?.kind === 'known' ? widget : null
  // A Widget that goes (another device removed it) takes its options with it for good: were they
  // only hidden, they would come back, uninvited, if it came back with the same id (an undo).
  useEffect(() => {
    if (opened && !target) close()
  }, [close, opened, target])

  // What each change starts from: the Layout as of the last change made, so a second change
  // before the page has drawn the first still has it. Each render brings it up to date.
  const latest = useRef(layout)
  latest.current = layout
  const change = (id: string, next: Record<string, unknown>): Promise<boolean> => {
    if (!loaded) return Promise.resolve(false)
    const base = latest.current
    const settled = settle(base)
    const result = setOptions({ layout: settled, readOnly: !canChange }, id, next)
    if (!result.ok) return Promise.resolve(false)
    // Nothing to save: no Widget moves to where it is drawn, and no option is different.
    const was = placedIn(settled, id)?.options
    const now = placedIn(result.layout, id)?.options
    if (settled === base && same(was, now)) return Promise.resolve(true)
    latest.current = result.layout
    const outcome = commit(result.layout)
    return outcome && typeof (outcome as Promise<unknown>).then === 'function'
      ? (outcome as Promise<string>).then((saved) => {
          if (saved !== 'saved' && saved !== 'superseded' && latest.current === result.layout) {
            latest.current = base
          }
          return saved === 'saved' || saved === 'superseded'
        })
      : Promise.resolve(true)
  }

  const controls = useMemo<OptionsPopoverControls>(
    () => ({ available: true, close, open, openId: target ? openedId : null, toggle }),
    [close, open, openedId, target, toggle],
  )

  return (
    <OptionsPopoverContext.Provider value={controls}>
      {children}
      {opened && target && (
        <OptionsPopover
          box={boxOf(opened.id)}
          cells={{ h: target.placed.h, w: target.placed.w }}
          definition={target.definition}
          disabled={!canChange || !loaded}
          focusOption={opened.focusOption}
          key={opened.id}
          name={accessibleName(
            target.definition,
            readOptions(target.definition, target.placed.options),
          )}
          onChange={(next) => change(opened.id, next)}
          onClose={close}
          onPageValueChange={onPageValueChange}
          options={target.placed.options}
          page={page}
          pageValuesDisabled={pageValuesDisabled}
          readOnly={!canChange}
        />
      )}
    </OptionsPopoverContext.Provider>
  )
}
