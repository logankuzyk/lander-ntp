import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks'

import { parseColour } from '@/backdrop/colour'
import {
  type Background,
  BACKGROUND_COLOURS,
  DEFAULT_BACKGROUND,
  displayKind,
} from '@/backdrop/storage'
import { Callout } from '@/components/Callout/Callout'
import { MultiSelect } from '@/components/Dropdown/MultiSelect'
import { READ_ONLY_UPDATE_NOTE } from '@/components/EditMode/copy'
import { useEditMode } from '@/components/EditMode/useEditMode'
import { CloseIcon } from '@/components/Popover/CloseIcon'
import { useGrowOnScroll } from '@/components/Popover/useGrowOnScroll'
import { usePopover } from '@/components/Popover/usePopover'
import type { SettingsStop } from '@/onboarding/callouts'
import { NewMark } from '@/onboarding/NewMark'
import { useSeen } from '@/onboarding/useSeen'
import { FREQUENCIES, type Frequency, type PhotoSettings } from '@/photos/rotation'
import type { Photo } from '@/photos/schema'
import { availableTags } from '@/photos/tags'
import { FONT_IDS, type FontId, FONTS } from '@/settings/fonts'
import type { Settings } from '@/settings/schema'
import type { StorageItemOptions } from '@/settings/useStorageItem'
import { Choice } from '@/widgetSystem/controls/Choice'
import { Switch } from '@/widgetSystem/controls/Switch'

import { Gallery } from './Gallery'

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

/** What the panel says while the settings are from a newer version. */
const UPDATE_TO_CHANGE = READ_ONLY_UPDATE_NOTE

/** The "Change photo" choice that pins the photo on screen. */
const NEVER = 'never'

/** The Clock and the Weather are set up on their widgets (edit mode), not here. */
const SECTIONS = [
  ['photos', 'Background'],
  ['general', 'General'],
] as const

export type SectionId = (typeof SECTIONS)[number][0]

type PhotosSectionProps = {
  currentId: string | null
  onChange: (settings: Settings) => void
  photos: readonly Photo[]
  saveOutcome?: StorageItemOptions
  settings: Settings
}

type BackgroundSectionProps = {
  background: Background
  currentId: string | null
  onChange: (background: Background) => void
  onPreviewColour?: (colour: string | null) => void
  onSettingsChange: (settings: Settings) => void
  photos: readonly Photo[]
  saveOutcome?: StorageItemOptions
  settings: Settings
}

function BackgroundSection({
  background,
  currentId,
  onChange,
  onPreviewColour,
  onSettingsChange,
  photos,
  saveOutcome,
  settings,
}: BackgroundSectionProps) {
  const colourMode = displayKind(background) === 'colour'
  const [hex, setHex] = useState(background.colour.replace('#', ''))
  const [pickerColour, setPickerColour] = useState(background.colour)
  const [hexError, setHexError] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const custom = !BACKGROUND_COLOURS.some(
    (colour) => colour.toLowerCase() === background.colour.toLowerCase(),
  )
  useEffect(() => {
    setHex(background.colour.replace('#', ''))
    setPickerColour(background.colour)
  }, [background.colour])
  const setColour = (colour: string, save: boolean) => {
    setPickerColour(colour)
    setHex(colour.replace('#', ''))
    setHexError(false)
    onPreviewColour?.(colour)
    if (save) {
      onChange({ ...background, colour })
      onPreviewColour?.(null)
    }
  }
  const commitHex = () => {
    const colour = parseColour(hex)
    if (!colour) {
      setHexError(true)
      return
    }
    setColour(colour, true)
  }

  return (
    <>
      <section>
        <Choice<'colour' | 'photo'>
          choices={[
            { label: 'Photo', value: 'photo' },
            { label: 'Colour', value: 'colour' },
          ]}
          label="Background"
          onChange={(kind) => {
            onPreviewColour?.(null)
            onChange({
              ...background,
              colour: background.colour || DEFAULT_BACKGROUND.colour,
              kind,
            })
          }}
          value={displayKind(background)}
        />
      </section>
      {colourMode ? (
        <section aria-label="Background colour">
          <div aria-label="Background colour" class="background-swatches" role="radiogroup">
            {BACKGROUND_COLOURS.map((colour, index) => (
              <label class="background-swatch" key={colour} title={`Colour ${index + 1}`}>
                <input
                  aria-label={`Colour ${index + 1}`}
                  checked={!custom && background.colour.toLowerCase() === colour.toLowerCase()}
                  name="background-colour"
                  onChange={() => setColour(colour, true)}
                  type="radio"
                  value={colour}
                />
                <span aria-hidden="true" style={{ backgroundColor: colour }} />
              </label>
            ))}
            <label class="background-swatch" title="Custom colour">
              <input
                aria-label="Custom colour"
                checked={custom}
                name="background-colour"
                onChange={() => picker.current?.click()}
                type="radio"
              />
              <span aria-hidden="true" class="background-swatch__custom">
                +
              </span>
            </label>
          </div>
          <input
            aria-label="Choose custom colour"
            class="background-colour-picker"
            onChange={(event) => setColour(event.currentTarget.value, true)}
            onInput={(event) => setColour(event.currentTarget.value, false)}
            ref={picker}
            type="color"
            value={pickerColour}
          />
          <label class="settings__row settings__row--text">
            <span>Hex colour</span>
            <input
              aria-describedby={hexError ? 'background-hex-error' : undefined}
              aria-invalid={hexError}
              class="settings__input"
              maxLength={7}
              onBlur={commitHex}
              onInput={(event) => {
                setHex(event.currentTarget.value.replace(/^#/, ''))
                setHexError(false)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitHex()
              }}
              value={hex}
            />
          </label>
          {hexError && (
            <p class="settings__note" id="background-hex-error">
              Use six digits, like 1a2b3c
            </p>
          )}
        </section>
      ) : (
        <PhotosSection
          currentId={currentId}
          onChange={onSettingsChange}
          photos={photos}
          saveOutcome={saveOutcome}
          settings={settings}
        />
      )}
    </>
  )
}

function PhotosSection({ currentId, onChange, photos, saveOutcome, settings }: PhotosSectionProps) {
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
          saveOutcome={saveOutcome}
        />
      )}
    </>
  )
}

type SectionProps = {
  onChange: (settings: Settings) => void
  settings: Settings
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
 * Where the Clock's and the Weather's options went. The button is the Bottom bar's Edit button
 * from here: it closes the panel and enters edit mode, where every widget has its Options. It
 * changes no setting, so it sits outside the fieldset that a newer version's settings turn off.
 */
function EditPointer({ onClose }: { onClose: () => void }) {
  const { enter } = useEditMode()

  return (
    <p class="settings__note settings__edit">
      Clock and Weather options are on the widgets now.{' '}
      <button
        class="settings__link"
        onClick={() => {
          enter()
          // The panel is about to go, with focus in it; the page's button reads Done now.
          document.querySelector<HTMLElement>('[data-edit-toggle]')?.focus()
          onClose()
        }}
        type="button"
      >
        Edit
      </button>
    </p>
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
  background?: Background
  backgroundReadOnly?: boolean
  currentId: string | null
  /** The section to open on, when there is no tour to say. */
  initialSection?: SectionId
  onBackgroundChange?: (background: Background) => void
  onChange: (settings: Settings) => void
  onClose: () => void
  onPreviewColour?: (colour: string | null) => void
  /** Every photo in the manifest, for the gallery. */
  photos: readonly Photo[]
  /**
   * The settings were written by a newer version of the page, which would lose something if
   * this one saved over them: they can be looked at and not changed.
   */
  readOnly?: boolean
  saveOutcome?: StorageItemOptions
  settings: Settings
  /** Stops to walk through, one note beside the panel at a time; see onboarding/callouts. */
  tour?: readonly SettingsStop[]
  /**
   * Where the tour is on the page before it comes here: the stops already shown, and how many
   * there are in all, so that the first stop here reads "6 of 7" and not "1 of 2". Without it
   * the panel's stops are counted alone.
   */
  tourProgress?: { before: number; total: number }
}

/** Settings, in the popover corner above the controls. Opened with the gear button. */
export function SettingsPanel({
  background = DEFAULT_BACKGROUND,
  backgroundReadOnly = false,
  currentId,
  initialSection = 'photos',
  onBackgroundChange = () => {},
  onChange,
  onClose,
  onPreviewColour,
  photos,
  readOnly = false,
  saveOutcome,
  settings,
  tour = [],
  tourProgress,
}: SettingsPanelProps) {
  const known = useKnownTags(settings, photos)
  const readOnlyId = useId()
  const { markSeen: markPhotosSeen, seen: photosSeen } = useSeen('photos')
  // Carrying on from the tour on the page, focus is on the note's button, where the last stop had
  // it, and not on Close, which one more Enter would press.
  const carryingOn = tourProgress !== undefined && tour.length > 0
  const { close, container } = usePopover(onClose, { keepFocus: carryingOn })
  const body = useRef<HTMLDivElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const [section, setSection] = useState<SectionId>(tour[0]?.section ?? initialSection)
  // Where the tour has got to; null when there is none, or once it is over.
  const [step, setStep] = useState<number | null>(tour.length > 0 ? 0 : null)
  const stop = step === null ? undefined : tour[step]
  const resetGrowth = useGrowOnScroll(container, body)
  useEffect(() => {
    if (carryingOn) container.current?.querySelector<HTMLElement>('.callout__action')?.focus()
    // Once, as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Each section starts at rest, from the top. The tour follows along: opening a section it
  // has a stop for moves it there.
  const show = (id: SectionId) => {
    setSection(id)
    resetGrowth()
    const index = tour.findIndex((callout) => callout.section === id)
    if (index !== -1) setStep((at) => (at === null ? null : index))
  }

  useEffect(() => {
    if (section === 'photos' && photosSeen === false) void markPhotosSeen()
  }, [section, photosSeen, markPhotosSeen])

  // The tour ends with Done, or Dismiss: focus was on the note's button, which goes, so it goes to
  // the panel's Close button and not the page behind it.
  const endTour = () => {
    if (document.activeElement?.closest('.callout')) close.current?.focus()
    setStep(null)
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
              : { label: 'Done', onClick: endTour }
          }
          body={stop.body}
          class="callout--tour"
          onDismiss={endTour}
          progress={`${(tourProgress?.before ?? 0) + step + 1} of ${tourProgress?.total ?? tour.length}`}
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

      {readOnly && (
        <p class="settings__note settings__readonly" id={readOnlyId}>
          {UPDATE_TO_CHANGE}
        </p>
      )}

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
              {id === 'photos' && photosSeen === false && <NewMark />}
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
          {/* Switches every control in the section off at once; the tabs stay, to look around. */}
          {section === 'photos' && backgroundReadOnly && !readOnly && (
            <p class="settings__note settings__readonly" id={readOnlyId}>
              {UPDATE_TO_CHANGE}
            </p>
          )}
          <fieldset
            aria-describedby={
              readOnly || (section === 'photos' && backgroundReadOnly) ? readOnlyId : undefined
            }
            class="settings__fieldset"
            disabled={readOnly || (section === 'photos' && backgroundReadOnly)}
          >
            {section === 'photos' && (
              <BackgroundSection
                background={background}
                currentId={currentId}
                onChange={onBackgroundChange}
                onPreviewColour={onPreviewColour}
                onSettingsChange={onChange}
                photos={photos}
                saveOutcome={saveOutcome}
                settings={known}
              />
            )}
            {section === 'general' && <GeneralSection onChange={onChange} settings={known} />}
          </fieldset>
          {section === 'general' && <EditPointer onClose={onClose} />}
        </div>
      </div>
    </aside>
  )
}
