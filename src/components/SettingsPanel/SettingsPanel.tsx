import { useId, useMemo, useRef, useState } from 'preact/hooks'

import { Callout } from '@/components/Callout/Callout'
import { MultiSelect } from '@/components/Dropdown/MultiSelect'
import { CloseIcon } from '@/components/Popover/CloseIcon'
import { useGrowOnScroll } from '@/components/Popover/useGrowOnScroll'
import { usePopover } from '@/components/Popover/usePopover'
import type { CalloutInfo } from '@/onboarding/callouts'
import { FREQUENCIES, type Frequency, type PhotoSettings } from '@/photos/rotation'
import type { Photo } from '@/photos/schema'
import { availableTags } from '@/photos/tags'
import { FONT_IDS, type FontId, FONTS } from '@/settings/fonts'
import type { Settings, WeatherSettings } from '@/settings/schema'
import { allowLocation } from '@/weather/consent'
import { weatherDefinition } from '@/widgets/Weather/definition'
import { Choice } from '@/widgetSystem/controls/Choice'
import { PlaceControl } from '@/widgetSystem/controls/PlaceControl'
import { Switch } from '@/widgetSystem/controls/Switch'

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

export type SectionId = (typeof SECTIONS)[number][0]

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
          choices={[
            ...FREQUENCIES.map((id) => ({ label: FREQUENCY_LABELS[id], value: id })),
            { label: 'Never', value: NEVER },
          ]}
          label="Change photo"
          onChange={(choice) =>
            choice === NEVER
              ? update({ mode: 'pinned', pinnedId: currentId })
              : update({ frequency: choice, mode: 'cycle' })
          }
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
        <Switch
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
      <Switch
        checked={settings.clock.enabled}
        label="Show clock"
        onChange={(enabled) => clock({ enabled })}
      />
      {/* Out of the way of both the eye and Tab while the clock is off. */}
      {settings.clock.enabled && (
        <>
          <Switch
            checked={!settings.clock.hour12}
            label="24-hour time"
            onChange={(h24) => clock({ hour12: !h24 })}
          />
          <Switch
            checked={settings.clock.showDate}
            label="Show date"
            onChange={(showDate) => clock({ showDate })}
          />
          <Switch
            checked={settings.clock.showSeconds}
            label="Show seconds"
            onChange={(showSeconds) => clock({ showSeconds })}
          />
        </>
      )}
    </section>
  )
}

function WeatherSection({ onChange, settings }: SectionProps) {
  const current = settings.weather
  // The line is the Weather's own, which its options show; the panel draws it until they replace it.
  const { credit } = weatherDefinition
  const [, setRefused] = useState(0)

  // The place control's following and `enable` wait on the browser's prompts, and the settings
  // can change meanwhile: a change is laid over the settings as they are when it is made, not as
  // they were at the click.
  const latest = useRef(settings)
  latest.current = settings

  const weather = (changes: Partial<WeatherSettings>) =>
    onChange({ ...latest.current, weather: { ...latest.current.weather, ...changes } })

  const enable = async (enabled: boolean) => {
    // Nothing changed, but the checkbox has ticked itself: render again to put it back.
    if (enabled && !(await allowLocation())) return setRefused((count) => count + 1)
    weather({ enabled })
  }

  return (
    <>
      <section>
        <Switch
          checked={current.enabled}
          label="Show weather"
          onChange={(enabled) => void enable(enabled)}
        />
        {current.enabled && (
          <PlaceControl
            label="Place"
            onChange={weather}
            value={{ followDevice: current.followDevice, place: current.place }}
          />
        )}
        {current.enabled && (
          <>
            <Choice<WeatherSettings['unit']>
              choices={[
                { label: 'Celsius', value: 'celsius' },
                { label: 'Fahrenheit', value: 'fahrenheit' },
              ]}
              label="Units"
              onChange={(unit) => weather({ unit })}
              value={current.unit}
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
      {current.enabled && credit && (
        <p class="settings__note settings__credit">
          <a href={credit.href}>{credit.text}</a>
        </p>
      )}
    </>
  )
}

function GeneralSection({ onChange, settings }: SectionProps) {
  return (
    <section>
      <Choice<FontId>
        choices={FONT_IDS.map((id) => ({ label: FONTS[id].label, value: id }))}
        label="Font"
        onChange={(font) => onChange({ ...settings, font })}
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
  /** The section to open on, when there is no tour to say. */
  initialSection?: SectionId
  onChange: (settings: Settings) => void
  onClose: () => void
  /** Every photo in the manifest, for the gallery. */
  photos: readonly Photo[]
  settings: Settings
  /** Stops to walk through, one note beside the panel at a time; see onboarding/callouts. */
  tour?: readonly CalloutInfo[]
}

/** Settings, in the popover corner above the controls. Opened with the gear button. */
export function SettingsPanel({
  currentId,
  initialSection = 'photos',
  onChange,
  onClose,
  photos,
  settings,
  tour = [],
}: SettingsPanelProps) {
  const known = useKnownTags(settings, photos)
  const { close, container } = usePopover(onClose)
  const body = useRef<HTMLDivElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const [section, setSection] = useState<SectionId>(tour[0]?.section ?? initialSection)
  // Where the tour has got to; null when there is none, or once it is over.
  const [step, setStep] = useState<number | null>(tour.length > 0 ? 0 : null)
  const stop = step === null ? undefined : tour[step]
  const resetGrowth = useGrowOnScroll(container, body)

  // Each section starts at rest, from the top. The tour follows along: opening a section it
  // has a stop for moves it there.
  const show = (id: SectionId) => {
    setSection(id)
    resetGrowth()
    const index = tour.findIndex((callout) => callout.section === id)
    if (index !== -1) setStep((at) => (at === null ? null : index))
  }

  const nextStop = step === null ? undefined : tour[step + 1]
  // "Next" acts after its note has faded: not if a section was opened by hand meanwhile.
  const latestSection = useRef(section)
  latestSection.current = section

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
      {/* Inside the panel, so a press on it isn't a click outside. */}
      {stop && step !== null && (
        <Callout
          action={
            nextStop
              ? {
                  label: 'Next',
                  onClick: () => {
                    if (latestSection.current === section) show(nextStop.section)
                  },
                }
              : { label: 'Done', onClick: () => setStep(null) }
          }
          body={stop.body}
          class="callout--tour"
          onDismiss={() => setStep(null)}
          progress={`${step + 1} of ${tour.length}`}
          title={stop.title}
        />
      )}
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
