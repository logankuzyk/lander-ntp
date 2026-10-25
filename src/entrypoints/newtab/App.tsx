import { useCallback, useEffect, useLayoutEffect, useState } from 'preact/hooks'

import { Background } from '@/components/Background/Background'
import { Callout } from '@/components/Callout/Callout'
import { Controls } from '@/components/Controls/Controls'
import { Notice } from '@/components/Notice/Notice'
import { PhotoCredit } from '@/components/PhotoCredit/PhotoCredit'
import { PhotoInfo } from '@/components/PhotoInfo/PhotoInfo'
import { type SectionId, SettingsPanel } from '@/components/SettingsPanel/SettingsPanel'
import { Welcome } from '@/components/Welcome/Welcome'
import { TOUR } from '@/onboarding/callouts'
import { onboardingItem } from '@/onboarding/storage'
import { useNews } from '@/onboarding/useNews'
import { preloadNext } from '@/photos/image'
import { usePhotoRotation } from '@/photos/usePhotoRotation'
import { fontStack } from '@/settings/fonts'
import { settingsItem } from '@/settings/storage'
import { useStorageItem } from '@/settings/useStorageItem'
import { pageValues, widgetsFromSettings } from '@/widgetSystem/fromSettings'
import { widgetDefinition } from '@/widgetSystem/registry'
import { WidgetHost } from '@/widgetSystem/WidgetHost'

/** The popovers share the corner above the controls, so only one is open at a time. */
type Popover = 'info' | 'settings' | null

/** How the settings were opened: on which section, and whether with the welcome tour. */
type SettingsEntry = { section: SectionId; tour: boolean }

const FROM_GEAR: SettingsEntry = { section: 'photos', tour: false }

/** How long "Couldn't save that" stays, unless it is dismissed or a save goes through first. */
const SAVE_FAILED_MS = 8_000

export function App() {
  // Whether to say so, and how many have failed: each failure starts the 8 seconds over.
  const [saveFailed, setSaveFailed] = useState(false)
  const [saveFailures, setSaveFailures] = useState(0)
  // From either item: the next save that goes through, whichever it is, clears the line.
  const saveOutcome = {
    onRejected: () => {
      setSaveFailed(true)
      setSaveFailures((count) => count + 1)
    },
    onSaved: () => setSaveFailed(false),
  }
  // Read-only when a newer version of the page wrote the settings: nothing here saves over them.
  const [settings, setSettings, settingsLoaded, settingsReadOnly] = useStorageItem(
    settingsItem,
    saveOutcome,
  )
  const [onboarding, setOnboarding] = useStorageItem(onboardingItem, saveOutcome)
  const [popover, setPopover] = useState<Popover>(null)
  const [entry, setEntry] = useState<SettingsEntry>(FROM_GEAR)
  const [photoLoading, setPhotoLoading] = useState(false)
  // Wait for the stored settings: the fallback is every-visit, which would move the photo on
  // in every new tab regardless of the setting.
  const { next, photo, photos, upcoming } = usePhotoRotation(
    settingsLoaded ? settings.photos : null,
  )

  const toggle = (which: Exclude<Popover, null>) =>
    setPopover((open) => (open === which ? null : which))
  const close = useCallback(() => setPopover(null), [])
  const openSettings = (how: SettingsEntry) => {
    setEntry(how)
    setPopover('settings')
  }

  // Out of the way while a popover has the corner, and until the welcome has been answered.
  const news = useNews(popover === null ? onboarding : null, settingsLoaded ? settings : null)
  const dismiss = (id: string) => {
    if (onboarding) setOnboarding({ ...onboarding, dismissed: [...onboarding.dismissed, id] })
  }

  // While a photo is pinned, → pins the next one instead, so the next tab keeps it too.
  const showNext = () => {
    void (async () => {
      const id = await next()
      // The photo moves on; the settings, which would say which, are not this version's to write.
      if (settingsReadOnly) return
      const latest = await settingsItem.getValue()
      if (id && latest.photos.mode === 'pinned' && latest.photos.pinnedId !== id) {
        setSettings({ ...latest, photos: { ...latest.photos, pinnedId: id } })
      }
    })()
  }

  useEffect(() => {
    if (saveFailures === 0) return
    const timer = setTimeout(() => setSaveFailed(false), SAVE_FAILED_MS)
    return () => clearTimeout(timer)
  }, [saveFailures])

  // Before paint, so the clock is never drawn in one font and then redrawn in another.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--font-display', fontStack(settings.font))
  }, [settings.font])

  return (
    <main class="app">
      {photo && (
        <Background
          dim={settings.dim}
          onLoad={() => {
            if (upcoming) preloadNext(upcoming)
          }}
          onLoadingChange={setPhotoLoading}
          photo={photo}
        />
      )}
      {/*
        Stored settings land a beat after the first paint. Drawing the defaults and then
        correcting them is a visible jolt — a clock that jumps fonts, say — so anything that
        depends on them waits for them. The photo already does: usePhotoRotation is held back
        until the settings are known.
      */}
      {settingsLoaded &&
        widgetsFromSettings(settings).map(({ options, type }) => {
          const definition = widgetDefinition(type)
          return (
            definition && (
              <WidgetHost
                definition={definition}
                key={type}
                options={options}
                page={pageValues(settings)}
              />
            )
          )
        })}
      {photo && <PhotoCredit photo={photo} />}
      {photo && popover === 'info' && <PhotoInfo onClose={close} photo={photo} />}
      {popover === 'settings' && (
        <SettingsPanel
          currentId={photo?.id ?? null}
          initialSection={entry.section}
          onChange={setSettings}
          onClose={close}
          photos={photos}
          readOnly={settingsReadOnly}
          settings={settings}
          tour={entry.tour ? TOUR : undefined}
        />
      )}
      {news && (
        <Callout
          action={{
            label: 'Set up',
            onClick: () => {
              dismiss(news.id)
              openSettings({ section: news.section, tour: false })
            },
          }}
          body={news.body}
          class={`callout--${news.section}`}
          onDismiss={() => dismiss(news.id)}
          title={news.title}
        />
      )}
      {onboarding && !onboarding.welcomed && (
        <Welcome
          onSkip={() => setOnboarding({ ...onboarding, welcomed: true })}
          onTour={() => {
            setOnboarding({ ...onboarding, welcomed: true })
            openSettings({ section: 'photos', tour: true })
          }}
        />
      )}
      <Notice
        message={saveFailed ? "Couldn't save that. Try again in a minute." : null}
        onDismiss={() => setSaveFailed(false)}
      />
      <Controls
        busy={photoLoading}
        infoOpen={popover === 'info'}
        onNext={showNext}
        onToggleInfo={photo ? () => toggle('info') : undefined}
        onToggleSettings={() => {
          setEntry(FROM_GEAR)
          toggle('settings')
        }}
        settingsOpen={popover === 'settings'}
      />
    </main>
  )
}
