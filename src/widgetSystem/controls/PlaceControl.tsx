import { useEffect, useRef, useState } from 'preact/hooks'

import { CURRENT_LOCATION, devicePosition, locate } from '@/weather/deviceLocation'
import { placeName } from '@/weather/placeName'

import type { PlaceValue } from '../definition'
import { PlaceSearch } from './PlaceSearch'

type PlaceControlProps = {
  /** Shows the place, or the search box, but changes nothing. */
  disabled?: boolean
  /** The search takes focus when it appears, without suggesting yet: see `PlaceSearch`. */
  focusOnMount?: boolean
  /** What people read beside the place once there is one. */
  label: string
  /** Both keys at once, whichever changed: a place picked, or the device followed. */
  onChange: (value: PlaceValue) => void
  value: PlaceValue
}

/**
 * A place, or the device's own position. Without one it is the search box, whose first
 * suggestion is "Current location"; with one it is a row naming it, and Change brings the
 * search back.
 *
 * Picking a place sets it and stops following the device. Following keeps the place as it was:
 * the position itself goes to local storage, where the widget picks it up, and the value only
 * records that the device is followed.
 */
export function PlaceControl({
  disabled = false,
  focusOnMount = false,
  label,
  onChange,
  value,
}: PlaceControlProps) {
  const [changing, setChanging] = useState(false)
  const [locateFailed, setLocateFailed] = useState(false)

  // Following waits on the browser's prompt, and the value can change meanwhile: the change
  // is made from the value as it is when the answer comes, not as it was at the click.
  const latest = useRef(value)
  latest.current = value
  const locating = useRef(false)

  // The search that had focus goes when a place is picked; focus goes to Change, in the row that
  // replaces it, rather than being dropped on the page.
  const change = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)
  useEffect(() => {
    // Asked once, by the next render. A pick that was not kept draws nothing new, so its ask can
    // be answered by a later render, when focus may have gone somewhere else (a place arriving
    // from another tab): it is given only if focus is on nothing, as it is when the search that
    // had it goes, and is never kept for later.
    const wanted = refocus.current
    refocus.current = false
    const lost = !document.activeElement || document.activeElement === document.body
    if (wanted && lost) change.current?.focus()
  })

  // The click that shows the browser's prompt.
  const follow = async () => {
    if (locating.current) return
    locating.current = true
    setLocateFailed(false)
    try {
      const position = await locate()
      if (!position) return setLocateFailed(true)
      await devicePosition.setValue({ ...position, name: await placeName(position) })
      setChanging(false)
      refocus.current = true
      onChange({ followDevice: true, place: latest.current.place })
    } finally {
      locating.current = false
    }
  }

  return (value.place || value.followDevice) && !changing ? (
    <div class="settings__row">
      <span>{label}</span>
      <span>
        {value.followDevice ? CURRENT_LOCATION : value.place?.name}{' '}
        <button
          class="settings__link"
          disabled={disabled}
          onClick={() => setChanging(true)}
          ref={change}
          type="button"
        >
          Change
        </button>
      </span>
    </div>
  ) : (
    <PlaceSearch
      disabled={disabled}
      focusOnMount={focusOnMount}
      locateFailed={locateFailed}
      onLocate={() => void follow()}
      onSelect={(place) => {
        setChanging(false)
        refocus.current = true
        onChange({ followDevice: false, place })
      }}
    />
  )
}
