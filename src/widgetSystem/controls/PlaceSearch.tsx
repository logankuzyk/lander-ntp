import { useEffect, useId, useRef, useState } from 'preact/hooks'

import { usePlacement } from '@/components/Dropdown/usePlacement'
import type { Place } from '@/settings/schema'
import { CURRENT_LOCATION } from '@/weather/deviceLocation'
import { type PlaceResult, searchPlaces } from '@/weather/openMeteo'

/** How long the typing has to pause before it is searched for: one request a pause. */
const DEBOUNCE_MS = 300
/** Shorter than this finds nothing worth showing. */
const MIN_LENGTH = 2

type PlaceSearchProps = {
  /** The box cannot be typed in, and suggests nothing. */
  disabled?: boolean
  /**
   * Takes focus when it appears, with the suggestions left closed until the box is clicked,
   * typed in or moved through with the arrow keys: so Escape, pressed first, closes whatever the
   * search sits in and not just a list nobody asked for.
   */
  focusOnMount?: boolean
  locateFailed: boolean
  /** Follow the device instead of a place searched for. */
  onLocate: () => void
  onSelect: (place: Place) => void
}

/**
 * Find a place by name, or follow the device. Suggestions float under the box while it has
 * focus: the device's location until there are places to show, then the places found for the
 * text so far. The arrow keys move through them, putting each in the box, and Enter takes the
 * one there.
 */
export function PlaceSearch({
  disabled = false,
  focusOnMount = false,
  locateFailed,
  onLocate,
  onSelect,
}: PlaceSearchProps) {
  const listId = useId()
  const [query, setQuery] = useState('')
  /** Null with nothing to search for; 'failed' when the search itself didn't go through. */
  const [results, setResults] = useState<'failed' | PlaceResult[] | null>(null)
  const [open, setOpen] = useState(false)
  /** Which suggestion the arrow keys are on; null is the text as typed. */
  const [active, setActive] = useState<number | null>(null)
  /** The box and the notes under it, which the suggestions sit below. */
  const anchor = useRef<HTMLDivElement>(null)
  /** Counts the searches, to tell an answer for text since typed over from the latest. */
  const request = useRef(0)
  const list = useRef<HTMLUListElement>(null)
  const input = useRef<HTMLInputElement>(null)
  /** Set while the box is given focus by `focusOnMount`, which is not a reason to suggest. */
  const quiet = useRef(false)

  usePlacement(open, anchor, list, 'fill', results)

  useEffect(() => {
    if (!focusOnMount || !input.current) return
    quiet.current = true
    input.current.focus()
    quiet.current = false
    // Only as it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const name = query.trim()
  useEffect(() => {
    const mine = ++request.current
    // A box that is held back sends nothing, whatever gets typed into it.
    if (disabled || name.length < MIN_LENGTH) return setResults(null)
    const timer = setTimeout(() => {
      void searchPlaces(name).then((found) => {
        if (mine !== request.current) return
        setResults(found ?? 'failed')
        // The suggestions have changed under the arrow keys: back to the text as typed.
        setActive(null)
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [disabled, name])

  const found = results !== 'failed' && results ? results : []
  const suggestions =
    found.length > 0
      ? found.map(({ id, label, place }) => ({
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
    if (disabled) return
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
      <div class="settings__place" ref={anchor}>
        <div class="settings__search" role="search">
          <input
            aria-activedescendant={open && chosen ? optionId(chosen.id) : undefined}
            aria-autocomplete="list"
            aria-controls={open ? listId : undefined}
            aria-expanded={open}
            aria-label="Search for a place"
            autocomplete="off"
            class="settings__input"
            disabled={disabled}
            onBlur={close}
            onClick={() => {
              if (!disabled) setOpen(true)
            }}
            onFocus={() => {
              if (!quiet.current && !disabled) setOpen(true)
            }}
            onInput={(event) => {
              if (disabled) return
              setQuery(event.currentTarget.value)
              setActive(null)
              setOpen(true)
            }}
            onKeyDown={onKeyDown}
            placeholder="City or town"
            ref={input}
            role="combobox"
            type="search"
            value={chosen ? chosen.label : query}
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
      {open && !disabled && (
        <ul
          aria-label="Places"
          class="dropdown__menu suggestions"
          id={listId}
          // Focus stays in the box, so a press here doesn't close the list under the click.
          onMouseDown={(event) => event.preventDefault()}
          // Its own scrolling: the popover shouldn't grow under it.
          onWheel={(event) => event.stopPropagation()}
          ref={list}
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            // The keys are the box's, where focus stays: see onKeyDown.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              aria-selected={index === active}
              class="dropdown__option suggestions__option"
              id={optionId(suggestion.id)}
              key={suggestion.id}
              onClick={() => {
                close()
                suggestion.pick()
              }}
              role="option"
            >
              {suggestion.label}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
