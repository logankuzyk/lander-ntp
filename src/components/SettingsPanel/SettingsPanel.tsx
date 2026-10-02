import { useId, useMemo, useRef, useState } from 'preact/hooks'

import { MultiSelect } from '@/components/Dropdown/MultiSelect'
import { Select } from '@/components/Dropdown/Select'
import { CloseIcon } from '@/components/Popover/CloseIcon'
import { useGrowOnScroll } from '@/components/Popover/useGrowOnScroll'
import { usePopover } from '@/components/Popover/usePopover'
import { FREQUENCIES, type Frequency, type PhotoSettings } from '@/photos/rotation'
import type { Photo } from '@/photos/schema'
import { availableTags } from '@/photos/tags'
import { FONT_IDS, type FontId, FONTS } from '@/settings/fonts'
import type { Place, Settings, WeatherSettings } from '@/settings/schema'
import { allowLocation } from '@/weather/consent'
import { CURRENT_LOCATION, devicePosition, locate } from '@/weather/deviceLocation'
import { type PlaceResult, searchPlaces } from '@/weather/openMeteo'
import { placeName } from '@/weather/placeName'

import { Gallery } from './Gallery'
import { WeatherFields } from './WeatherFields'

const FREQUENCY_LABELS: Record<Frequency, string> = {
  '1h': 'Every hour',
  '1m': 'Every minute',
  '5m': 'Every 5 minutes',
  '6h': 'Every 6 hours',
  '12h': 'Every 12 hours',
  '15m': 'Every 15 minutes',
  '30s': 'Every 30 seconds',
  daily: 'Every day',
  'every-visit': 'Every new tab',
}

/** The "Change photo" choice that pins the photo on screen. */
const NEVER = 'never'

const SECTIONS = [
  ['photos', 'Photos'],
  ['clock', 'Clock'],
  ['weather', 'Weather'],
  ['general', 'General'],
] as const

type SectionId = (typeof SECTIONS)[number][0]

type ToggleProps = {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}

function Toggle({ checked, label, onChange }: ToggleProps) {
  return (
    <label class="settings__row">
      <span>{label}</span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
    </label>
  )
}

type ChoiceProps<T extends string> = {
  label: string
  onChange: (value: T) => void
  options: readonly (readonly [T, string])[]
  value: T
}

function Choice<T extends string>({ label, onChange, options, value }: ChoiceProps<T>) {
  const labelId = useId()
  return (
    <div class="settings__row">
      <span id={labelId}>{label}</span>
      <Select labelId={labelId} onChange={onChange} options={options} value={value} />
    </div>
  )
}

type PhotosSectionProps = {
  currentId: string | null
  onChange: (settings: Settings) => void
  photos: readonly Photo[]
  settings: Settings
}

function PhotosSection({ currentId, onChange, photos, settings }: PhotosSectionProps) {
  const cycling = settings.photos
  const pinned = cycling.mode === 'pinned'
  const tags = useMemo(() => availableTags(photos), [photos])

  const tagsLabel = useId()

  const update = (changes: Partial<PhotoSettings>) =>
    onChange({ ...settings, photos: { ...cycling, ...changes } })

  return (
    <>
      <section aria-labelledby="cycling-heading">
        <h3 id="cycling-heading">Cycling</h3>
        <Choice<Frequency | typeof NEVER>
          label="Change photo"
          onChange={(choice) =>
            choice === NEVER
              ? update({ mode: 'pinned', pinnedId: currentId })
              : update({ frequency: choice, mode: 'cycle' })
          }
          options={[
            ...FREQUENCIES.map((id) => [id, FREQUENCY_LABELS[id]] as const),
            [NEVER, 'Never'],
          ]}
          value={pinned ? NEVER : cycling.frequency}
        />
        {/* Only while cycling. The tags are kept while a photo is pinned, for when it resumes. */}
        {!pinned && tags.length > 0 && (
          <div class="settings__row settings__row--wrap">
            <span id={tagsLabel}>Tags</span>
            <MultiSelect
              allLabel="All"
              labelId={tagsLabel}
              onChange={(chosen) => update({ tags: chosen })}
              options={tags.map(({ name, slug }) => ({ label: name, value: slug }))}
              value={cycling.tags}
            />
          </div>
        )}
        {pinned && (
          <p class="settings__note">
            Keeping this photo.{' '}
            <button class="settings__link" onClick={() => update({ mode: 'cycle' })} type="button">
              Resume cycling
            </button>
          </p>
        )}
        <Toggle
          checked={settings.dim}
          label="Dim the photo"
          onChange={(dim) => onChange({ ...settings, dim })}
        />
      </section>

      {photos.length === 0 && <p class="settings__note">Loading photos…</p>}
      {photos.length > 1 && (
        <Gallery
          currentId={currentId}
          initialTag={cycling.tags.length === 1 ? (cycling.tags[0] ?? null) : null}
          // Remounted when the cycled tags change, so the filter follows them.
          key={cycling.tags.join(' ')}
          onSelect={(id) => update({ mode: 'pinned', pinnedId: id })}
          photos={photos}
        />
      )}
    </>
  )
}

type SectionProps = {
  onChange: (settings: Settings) => void
  settings: Settings
}

function ClockSection({ onChange, settings }: SectionProps) {
  const clock = (changes: Partial<Settings['clock']>) =>
    onChange({ ...settings, clock: { ...settings.clock, ...changes } })

  return (
    <section>
      <Toggle
        checked={settings.clock.enabled}
        label="Show clock"
        onChange={(enabled) => clock({ enabled })}
      />
      {/* Out of the way of both the eye and Tab while the clock is off. */}
      {settings.clock.enabled && (
        <>
          <Toggle
            checked={!settings.clock.hour12}
            label="24-hour time"
            onChange={(h24) => clock({ hour12: !h24 })}
          />
          <Toggle
            checked={settings.clock.showDate}
            label="Show date"
            onChange={(showDate) => clock({ showDate })}
          />
          <Toggle
            checked={settings.clock.showSeconds}
            label="Show seconds"
            onChange={(showSeconds) => clock({ showSeconds })}
          />
        </>
      )}
    </section>
  )
}

type PlaceSearchProps = {
  onSelect: (place: Place) => void
}

/** Find a place by name. Searches on submit rather than per keystroke: one request a search. */
function PlaceSearch({ onSelect }: PlaceSearchProps) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  /** Null before the first search; 'failed' when the search itself didn't go through. */
  const [results, setResults] = useState<'failed' | PlaceResult[] | null>(null)

  const search = async (event: Event) => {
    event.preventDefault()
    const name = query.trim()
    if (!name || searching) return
    setSearching(true)
    setResults((await searchPlaces(name)) ?? 'failed')
    setSearching(false)
  }

  return (
    <>
      <form class="settings__search" onSubmit={(event) => void search(event)} role="search">
        <input
          aria-label="Search for a place"
          class="settings__input"
          onInput={(event) => setQuery(event.currentTarget.value)}
          placeholder="City or town"
          type="search"
          value={query}
        />
        <button class="settings__button" disabled={searching || !query.trim()} type="submit">
          Search
        </button>
      </form>
      <div aria-live="polite">
        {results === 'failed' && <p class="settings__note">Couldn’t search just now.</p>}
        {results !== 'failed' && results?.length === 0 && (
          <p class="settings__note">No places found.</p>
        )}
      </div>
      {results !== 'failed' && results && results.length > 0 && (
        <ul aria-label="Places" class="settings__results">
          {results.map(({ id, label, place }) => (
            <li key={id}>
              <button class="settings__result" onClick={() => onSelect(place)} type="button">
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function WeatherSection({ onChange, settings }: SectionProps) {
  const current = settings.weather
  const [changingPlace, setChangingPlace] = useState(false)
  const [locateFailed, setLocateFailed] = useState(false)

  // `follow` and `enable` wait on the browser's prompts, and the settings can change meanwhile:
  // a change is laid over the settings as they are when it is made, not as they were at the click.
  const latest = useRef(settings)
  latest.current = settings
  const locating = useRef(false)

  const weather = (changes: Partial<WeatherSettings>) =>
    onChange({ ...latest.current, weather: { ...latest.current.weather, ...changes } })

  // The click that shows the browser's prompt. The position goes to local storage, where the
  // widget picks it up; the settings only record that the weather follows the device.
  const follow = async () => {
    if (locating.current) return
    locating.current = true
    setLocateFailed(false)
    try {
      const position = await locate()
      if (!position) return setLocateFailed(true)
      await devicePosition.setValue({ ...position, name: await placeName(position) })
      setChangingPlace(false)
      weather({ followDevice: true })
    } finally {
      locating.current = false
    }
  }

  const enable = async (enabled: boolean) => {
    if (enabled && !(await allowLocation())) return
    weather({ enabled })
  }

  return (
    <>
      <section>
        <Toggle
          checked={current.enabled}
          label="Show weather"
          onChange={(enabled) => void enable(enabled)}
        />
        {current.enabled &&
          ((current.place || current.followDevice) && !changingPlace ? (
            <div class="settings__row">
              <span>Place</span>
              <span>
                {current.followDevice ? CURRENT_LOCATION : current.place?.name}{' '}
                <button class="settings__link" onClick={() => setChangingPlace(true)} type="button">
                  Change
                </button>
              </span>
            </div>
          ) : (
            <>
              <PlaceSearch
                onSelect={(place) => {
                  setChangingPlace(false)
                  weather({ followDevice: false, place })
                }}
              />
              <p aria-live="polite" class="settings__note">
                <button class="settings__link" onClick={() => void follow()} type="button">
                  Use my location
                </button>
                {locateFailed && ' Couldn’t get your location. Check that this page is allowed it.'}
              </p>
            </>
          ))}
        {current.enabled && (
          <>
            <Choice<WeatherSettings['unit']>
              label="Units"
              onChange={(unit) => weather({ unit })}
              options={[
                ['celsius', 'Celsius'],
                ['fahrenheit', 'Fahrenheit'],
              ]}
              value={current.unit}
            />
            <Toggle
              checked={current.background}
              label="Background"
              onChange={(background) => weather({ background })}
            />
          </>
        )}
      </section>

      {current.enabled && (
        <section aria-labelledby="weather-show-heading">
          <h3 id="weather-show-heading">Show</h3>
          <WeatherFields fields={current.fields} onChange={(fields) => weather({ fields })} />
        </section>
      )}
      {current.enabled && (
        <p class="settings__note settings__credit">
          <a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>
        </p>
      )}
    </>
  )
}

function GeneralSection({ onChange, settings }: SectionProps) {
  return (
    <section>
      <Choice<FontId>
        label="Font"
        onChange={(font) => onChange({ ...settings, font })}
        options={FONT_IDS.map((id) => [id, FONTS[id].label] as const)}
        value={settings.font}
      />
    </section>
  )
}

/**
 * The settings without any cycled tag that no photo carries. They may have been synced from a
 * device with a newer manifest, or the photos may have lost them; either way they filter
 * nothing and there is no chip to clear them by. Every section writes from these, so the next
 * change clears them. Left alone while the photos load, when no tag is known yet.
 */
function useKnownTags(settings: Settings, photos: readonly Photo[]): Settings {
  const { tags } = settings.photos
  const known =
    photos.length === 0
      ? tags
      : tags.filter((slug) => photos.some((photo) => photo.tags.some((tag) => tag.slug === slug)))
  const changed = known.length !== tags.length
  return useMemo(
    () => (changed ? { ...settings, photos: { ...settings.photos, tags: known } } : settings),
    // `known` is rebuilt on every render; its length changing is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, changed],
  )
}

type SettingsPanelProps = {
  currentId: string | null
  onChange: (settings: Settings) => void
  onClose: () => void
  /** Every photo in the manifest, for the gallery. */
  photos: readonly Photo[]
  settings: Settings
}

/** Settings, in the popover corner above the controls. Opened with the gear button. */
export function SettingsPanel({
  currentId,
  onChange,
  onClose,
  photos,
  settings,
}: SettingsPanelProps) {
  const known = useKnownTags(settings, photos)
  const { close, container } = usePopover(onClose)
  const body = useRef<HTMLDivElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const [section, setSection] = useState<SectionId>('photos')
  const resetGrowth = useGrowOnScroll(container, body)

  // Each section starts at rest, from the top.
  const show = (id: SectionId) => {
    setSection(id)
    resetGrowth()
  }

  // Arrow keys move between tabs, as in any tab list; Tab moves on to the section.
  const onTabKeyDown = (event: KeyboardEvent, index: number) => {
    const last = SECTIONS.length - 1
    const target = {
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      End: last,
      Home: 0,
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    const wrapped = (target + SECTIONS.length) % SECTIONS.length
    const next = SECTIONS[wrapped]
    if (!next) return
    show(next[0])
    tabs.current[wrapped]?.focus()
  }

  return (
    <aside aria-label="Settings" class="popover settings" ref={container} role="dialog">
      <header class="popover__header">
        <h2>Settings</h2>
        <button
          aria-label="Close settings"
          class="popover__close"
          onClick={onClose}
          ref={close}
          type="button"
        >
          <CloseIcon />
        </button>
      </header>

      <div class="settings__layout">
        <div aria-orientation="vertical" class="settings__nav" role="tablist">
          {SECTIONS.map(([id, label], index) => (
            <button
              aria-controls="settings-section"
              aria-selected={section === id}
              class="settings__tab"
              id={`settings-tab-${id}`}
              key={id}
              onClick={() => show(id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              ref={(el) => {
                tabs.current[index] = el
              }}
              role="tab"
              tabIndex={section === id ? 0 : -1}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div
          aria-labelledby={`settings-tab-${section}`}
          class="settings__body"
          id="settings-section"
          ref={body}
          role="tabpanel"
        >
          {section === 'photos' && (
            <PhotosSection
              currentId={currentId}
              onChange={onChange}
              photos={photos}
              settings={known}
            />
          )}
          {section === 'clock' && <ClockSection onChange={onChange} settings={known} />}
          {section === 'weather' && <WeatherSection onChange={onChange} settings={known} />}
          {section === 'general' && <GeneralSection onChange={onChange} settings={known} />}
        </div>
      </div>
    </aside>
  )
}
