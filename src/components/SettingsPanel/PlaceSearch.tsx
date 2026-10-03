import { useEffect, useId, useRef, useState } from 'preact/hooks'

import { usePlacement } from '@/components/Dropdown/usePlacement'
import type { Place } from '@/settings/schema'
import { CURRENT_LOCATION } from '@/weather/deviceLocation'
import { searchPlaces, type PlaceResult } from '@/weather/openMeteo'

/** How long the typing has to pause before it is searched for: one request a pause. */
const DEBOUNCE_MS = 300
/** Shorter than this finds nothing worth showing. */
const MIN_LENGTH = 2

type PlaceSearchProps = {
  onSelect: (place: Place) => void
  /** Follow the device instead of a place searched for. */
  onLocate: () => void
  locateFailed: boolean
}

/**
 * Find a place by name, or follow the device. Suggestions float under the box while it has
 * focus: the device's location until there are places to show, then the places found for the
 * text so far. The arrow keys move through them, putting each in the box, and Enter takes the
 * one there.
 */
export function PlaceSearch({ onSelect, onLocate, locateFailed }: PlaceSearchProps) {
  const listId = useId()
  const [query, setQuery] = useState('')
  /** Null with nothing to search for; 'failed' when the search itself didn't go through. */
  const [results, setResults] = useState<PlaceResult[] | 'failed' | null>(null)
  const [open, setOpen] = useState(false)
  /** Which suggestion the arrow keys are on; null is the text as typed. */
  const [active, setActive] = useState<number | null>(null)
  /** The box and the notes under it, which the suggestions sit below. */
  const anchor = useRef<HTMLDivElement>(null)
  /** Counts the searches, to tell an answer for text since typed over from the latest. */
  const request = useRef(0)
  const list = useRef<HTMLUListElement>(null)

  usePlacement(open, anchor, list, 'fill', results)

  const name = query.trim()
  useEffect(() => {
    const mine = ++request.current
    if (name.length < MIN_LENGTH) return setResults(null)
    const timer = setTimeout(() => {
      void searchPlaces(name).then((found) => {
        if (mine !== request.current) return
        setResults(found ?? 'failed')
        // The suggestions have changed under the arrow keys: back to the text as typed.
        setActive(null)
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [name])

  const found = results !== 'failed' && results ? results : []
  const suggestions =
    found.length > 0
      ? found.map(({ id, place, label }) => ({
          id: String(id),
          label,
          pick: () => onSelect(place),
        }))
      : [{ id: 'device', label: CURRENT_LOCATION, pick: onLocate }]
  const chosen = active === null ? undefined : suggestions[active]
  const optionId = (id: string) => `${listId}-${id}`

  const close = () => {
    setOpen(false)
    setActive(null)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      // One slot past the suggestions is the text as typed, between the last and the first.
      const typed = suggestions.length
      const to =
        ((active ?? typed) + (event.key === 'ArrowDown' ? 1 : -1) + typed + 1) % (typed + 1)
      setActive(to === typed ? null : to)
      setOpen(true)
    } else if (event.key === 'Enter' && chosen) {
      event.preventDefault()
      close()
      chosen.pick()
    } else if (event.key === 'Escape' && open) {
      // Only the suggestions: the popover they sit in stays open.
      event.preventDefault()
      close()
    }
  }

  return (
    <>
      <div ref={anchor} class="settings__place">
        <div class="settings__search" role="search">
          <input
            type="search"
            role="combobox"
            class="settings__input"
            aria-label="Search for a place"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && chosen ? optionId(chosen.id) : undefined}
            autocomplete="off"
            placeholder="City or town"
            value={chosen ? chosen.label : query}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={close}
            onKeyDown={onKeyDown}
            onInput={(event) => {
              setQuery(event.currentTarget.value)
              setActive(null)
              setOpen(true)
            }}
          />
        </div>
        <div aria-live="polite">
          {locateFailed && (
            <p class="settings__note">
              Couldn’t get your location. Check that this page is allowed it.
            </p>
          )}
          {results === 'failed' && <p class="settings__note">Couldn’t search just now.</p>}
          {results !== 'failed' && results?.length === 0 && (
            <p class="settings__note">No places found.</p>
          )}
        </div>
      </div>
      {open && (
        <ul
          ref={list}
          id={listId}
          class="dropdown__menu suggestions"
          role="listbox"
          aria-label="Places"
          // Focus stays in the box, so a press here doesn't close the list under the click.
          onMouseDown={(event) => event.preventDefault()}
          // Its own scrolling: the popover shouldn't grow under it.
          onWheel={(event) => event.stopPropagation()}
        >
          {suggestions.map((suggestion, index) => (
            // The keys are the box's, where focus stays: see onKeyDown.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={suggestion.id}
              id={optionId(suggestion.id)}
              class="dropdown__option suggestions__option"
              role="option"
              aria-selected={index === active}
              onClick={() => {
                close()
                suggestion.pick()
              }}
            >
              {suggestion.label}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
