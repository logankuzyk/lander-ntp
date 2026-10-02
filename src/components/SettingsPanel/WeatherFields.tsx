import { Eye, EyeOff, GripVertical } from 'lucide-preact'
import { useState } from 'preact/hooks'

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

  const dragOver = (event: DragEvent, index: number) => {
    if (!draft) return
    // Says the row is a drop target; without it the drop is refused and the row snaps back.
    event.preventDefault()
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
    <ol class="fields" aria-labelledby="weather-show-heading">
      {shown.map((field, index) => {
        const label = LABELS[field.id]
        const classes = ['fields__row']
        if (!field.shown) classes.push('fields__row--hidden')
        if (draft?.dragging === field.id) classes.push('fields__row--dragging')
        return (
          <li
            key={field.id}
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
              onClick={() =>
                onChange(
                  fields.map((other) =>
                    other.id === field.id ? { ...other, shown: !other.shown } : other,
                  ),
                )
              }
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
