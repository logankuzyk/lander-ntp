import { Eye, EyeOff, GripVertical } from 'lucide-preact'
import { useLayoutEffect, useRef, useState } from 'preact/hooks'

import type { ListEntry } from '../definition'

const move = <T,>(list: readonly T[], from: number, to: number): T[] => {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

/**
 * Show or hide an entry, and move it to where the shown rows end and the hidden ones begin: an
 * entry switched on joins the end of the shown ones, one switched off leads the hidden ones.
 */
const toggle = <E extends ListEntry>(entries: readonly E[], id: E['id']): E[] => {
  const entry = entries.find((other) => other.id === id)
  if (!entry) return [...entries]
  const rest = entries.filter((other) => other.id !== id)
  const boundary = rest.findLastIndex((other) => other.shown) + 1
  return [...rest.slice(0, boundary), { ...entry, shown: !entry.shown }, ...rest.slice(boundary)]
}

/** How long a row takes to slide to its new place. */
const SLIDE_MS = 220

/**
 * Slide rows to where they now are, from where they were at the last render, so a row that
 * changes place moves there and the ones it displaces move out of its way. Returns a ref
 * callback for each row, and whether a row is still on its way: the list's order has already
 * changed by then, so what is under the pointer isn't yet what it appears to be.
 */
function useSlide(list: { current: HTMLElement | null }, order: string) {
  const rows = useRef(new Map<string, HTMLElement>())
  /** Where layout last put each row, from the top of the list. */
  const tops = useRef(new Map<string, number>())
  const sliding = useRef(new Map<string, Animation>())

  // Measured against the list, so scrolling the section between renders isn't taken for a move.
  useLayoutEffect(() => {
    const origin = list.current?.getBoundingClientRect().top ?? 0
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    for (const [id, row] of rows.current) {
      // A row still sliding is drawn off its place by this much; a second move starts there.
      const offset = sliding.current.has(id)
        ? new DOMMatrixReadOnly(getComputedStyle(row).transform).m42
        : 0
      const top = row.getBoundingClientRect().top - offset - origin
      const before = tops.current.get(id)
      tops.current.set(id, top)
      if (before === undefined || before === top || still || !row.animate) continue
      sliding.current.get(id)?.cancel()
      const slide = row.animate(
        [{ transform: `translateY(${before + offset - top}px)` }, { transform: 'none' }],
        { duration: SLIDE_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      )
      sliding.current.set(id, slide)
      const done = () => {
        if (sliding.current.get(id) === slide) sliding.current.delete(id)
      }
      slide.onfinish = done
      slide.oncancel = done
    }
  }, [list, order])

  const register = (id: string) => (row: HTMLElement | null) => {
    if (row) rows.current.set(id, row)
    else rows.current.delete(id)
  }

  return { isSliding: (id: string) => sliding.current.has(id), register }
}

type OrderedListControlProps<E extends ListEntry> = {
  /** Shows the list as it is, out of reach: the order and what is shown may not be changed. */
  disabled?: boolean
  /** The ids the list holds, with what to call each. */
  items: readonly { id: E['id']; label: string }[]
  /** The id of the heading that names the list. */
  labelledBy: string
  /** Every entry exactly once, in the order to draw them: what changed, whole. */
  onChange: (value: E[]) => void
  value: readonly E[]
}

/**
 * A list of things to show, in the order to draw them, each shown or hidden. Rows are dragged
 * into place, or moved with the arrow keys from their handle; the eye shows and hides a row.
 */
export function OrderedListControl<E extends ListEntry>({
  disabled = false,
  items,
  labelledBy,
  onChange,
  value: fields,
}: OrderedListControlProps<E>) {
  const labelOf = (id: E['id']) => items.find((item) => item.id === id)?.label ?? id

  /** The order while a row is being dragged. Only the drop is passed on. */
  const [draft, setDraft] = useState<{ dragging: E['id']; fields: E[] } | null>(null)
  const shown = draft?.fields ?? fields
  const list = useRef<HTMLOListElement>(null)
  const { isSliding, register } = useSlide(list, shown.map(({ id }) => id).join(' '))

  const dragOver = (event: DragEvent, index: number) => {
    if (!draft) return
    // Says the row is a drop target; without it the drop is refused and the row snaps back.
    event.preventDefault()
    // A row sliding out of the way is still passing under the pointer; it has already moved.
    const over = draft.fields[index]
    if (over && isSliding(over.id)) return
    const from = draft.fields.findIndex(({ id }) => id === draft.dragging)
    if (from !== index) setDraft({ ...draft, fields: move(draft.fields, from, index) })
  }

  const finish = (event: DragEvent) => {
    // Let go outside the list, or stopped with Escape: the order stays as it was.
    const cancelled = event.dataTransfer?.dropEffect === 'none'
    if (!cancelled && draft && draft.fields.some(({ id }, index) => id !== fields[index]?.id)) {
      onChange(draft.fields)
    }
    setDraft(null)
  }

  /** The handle a row was last moved from with the keys, and what to say about the move. */
  const moved = useRef<HTMLElement | null>(null)
  const [announcement, setAnnouncement] = useState('')

  // Moving a row's element in the document can take the focus off its handle; put it back, so
  // the next arrow key moves the same row again.
  useLayoutEffect(() => {
    if (moved.current && document.activeElement !== moved.current) moved.current.focus()
    moved.current = null
  })

  const onHandleKeyDown = (event: KeyboardEvent, index: number) => {
    const to = { ArrowDown: index + 1, ArrowUp: index - 1 }[event.key]
    const field = fields[index]
    if (to === undefined || !field) return
    event.preventDefault()
    if (to < 0 || to >= fields.length) return
    moved.current = event.currentTarget as HTMLElement
    const next = move(fields, index, to)
    const before = next[to - 1]
    setAnnouncement(
      before
        ? `${labelOf(field.id)} moved to be shown after ${labelOf(before.id).toLowerCase()}`
        : `${labelOf(field.id)} moved to be shown first`,
    )
    onChange(next)
  }

  return (
    <>
      <ol
        aria-labelledby={labelledBy}
        class="fields"
        // The gaps between rows take a drop too, so letting go there isn't a cancelled drag.
        onDragOver={(event) => draft && event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
        ref={list}
      >
        {shown.map((field, index) => {
          const label = labelOf(field.id)
          const classes = ['fields__row']
          if (!field.shown) classes.push('fields__row--hidden')
          if (draft?.dragging === field.id) classes.push('fields__row--dragging')
          return (
            <li
              class={classes.join(' ')}
              draggable={!disabled}
              key={field.id}
              onDragEnd={finish}
              onDragOver={(event) => dragOver(event, index)}
              onDragStart={(event) => {
                if (disabled) return event.preventDefault()
                // Firefox only starts a drag that carries data.
                event.dataTransfer?.setData('text/plain', label)
                if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
                setDraft({ dragging: field.id, fields: [...fields] })
              }}
              onDrop={(event) => event.preventDefault()}
              ref={register(field.id)}
            >
              <button
                aria-label={`Reorder ${label}`}
                class="fields__handle"
                disabled={disabled}
                onKeyDown={(event) => onHandleKeyDown(event, index)}
                title="Drag, or use the arrow keys, to reorder"
                type="button"
              >
                <GripVertical aria-hidden="true" size={14} />
              </button>
              <span class="fields__label">{label}</span>
              <button
                aria-label={`Show ${label}`}
                aria-pressed={field.shown}
                class="fields__eye"
                disabled={disabled}
                onClick={() => onChange(toggle(fields, field.id))}
                type="button"
              >
                {field.shown ? (
                  <Eye aria-hidden="true" size={16} />
                ) : (
                  <EyeOff aria-hidden="true" size={16} />
                )}
              </button>
            </li>
          )
        })}
      </ol>
      {/* The list changing order says nothing by itself to a screen reader. */}
      <p aria-live="polite" class="visually-hidden">
        {announcement}
      </p>
    </>
  )
}
