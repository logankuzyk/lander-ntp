import { Eye, EyeOff, GripVertical } from 'lucide-preact'
import { useLayoutEffect, useRef, useState } from 'preact/hooks'

import type { WeatherField, WeatherFieldSetting } from '@/settings/schema'

const LABELS: Record<WeatherField, string> = {
  location: 'Location',
  condition: 'Conditions',
  feelsLike: 'Feels like',
  highLow: 'High and low',
  sun: 'Sunrise and sunset',
}

const move = <T,>(list: readonly T[], from: number, to: number): T[] => {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

/**
 * Show or hide a field, and move it to where the shown rows end and the hidden ones begin: a
 * field switched on joins the end of the shown ones, one switched off leads the hidden ones.
 */
const toggle = (
  fields: readonly WeatherFieldSetting[],
  id: WeatherField,
): WeatherFieldSetting[] => {
  const field = fields.find((other) => other.id === id)
  if (!field) return [...fields]
  const rest = fields.filter((other) => other.id !== id)
  const boundary = rest.findLastIndex((other) => other.shown) + 1
  return [...rest.slice(0, boundary), { ...field, shown: !field.shown }, ...rest.slice(boundary)]
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

  return { register, isSliding: (id: string) => sliding.current.has(id) }
}

type WeatherFieldsProps = {
  fields: readonly WeatherFieldSetting[]
  onChange: (fields: WeatherFieldSetting[]) => void
}

/**
 * The lines under the temperature, in the order the widget draws them. Rows are dragged into
 * place, or moved with the arrow keys from their handle; the eye shows and hides a line.
 */
export function WeatherFields({ fields, onChange }: WeatherFieldsProps) {
  /** The order while a row is being dragged. Only the drop is written to settings. */
  const [draft, setDraft] = useState<{
    dragging: WeatherField
    fields: WeatherFieldSetting[]
  } | null>(null)
  const shown = draft?.fields ?? fields
  const list = useRef<HTMLOListElement>(null)
  const { register, isSliding } = useSlide(list, shown.map(({ id }) => id).join(' '))

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

  const finish = () => {
    if (draft && draft.fields.some(({ id }, index) => id !== fields[index]?.id)) {
      onChange(draft.fields)
    }
    setDraft(null)
  }

  const onHandleKeyDown = (event: KeyboardEvent, index: number) => {
    const to = { ArrowUp: index - 1, ArrowDown: index + 1 }[event.key]
    if (to === undefined) return
    event.preventDefault()
    if (to < 0 || to >= fields.length) return
    onChange(move(fields, index, to))
  }

  return (
    <ol ref={list} class="fields" aria-labelledby="weather-show-heading">
      {shown.map((field, index) => {
        const label = LABELS[field.id]
        const classes = ['fields__row']
        if (!field.shown) classes.push('fields__row--hidden')
        if (draft?.dragging === field.id) classes.push('fields__row--dragging')
        return (
          <li
            key={field.id}
            ref={register(field.id)}
            class={classes.join(' ')}
            draggable
            onDragStart={(event) => {
              // Firefox only starts a drag that carries data.
              event.dataTransfer?.setData('text/plain', label)
              if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
              setDraft({ dragging: field.id, fields: [...fields] })
            }}
            onDragOver={(event) => dragOver(event, index)}
            onDrop={(event) => event.preventDefault()}
            onDragEnd={finish}
          >
            <button
              type="button"
              class="fields__handle"
              aria-label={`Reorder ${label}`}
              title="Drag, or use the arrow keys, to reorder"
              onKeyDown={(event) => onHandleKeyDown(event, index)}
            >
              <GripVertical aria-hidden="true" size={14} />
            </button>
            <span class="fields__label">{label}</span>
            <button
              type="button"
              class="fields__eye"
              aria-label={`Show ${label}`}
              aria-pressed={field.shown}
              onClick={() => onChange(toggle(fields, field.id))}
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
  )
}
