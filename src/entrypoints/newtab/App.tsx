import { useCallback, useEffect, useLayoutEffect, useState } from 'preact/hooks'

import { readableInk } from '@/backdrop/readableInk'
import { displayKind } from '@/backdrop/storage'
import { useBackground } from '@/backdrop/useBackground'
import { AddMenuControlProvider } from '@/components/AddMenu/useAddMenuControl'
import { Background } from '@/components/Background/Background'
import { Callout } from '@/components/Callout/Callout'
import { PageNews } from '@/components/Callout/PageNews'
import { PageTour } from '@/components/Callout/PageTour'
import { Controls } from '@/components/Controls/Controls'
import { EditModeProvider } from '@/components/EditMode/useEditMode'
import { Grid } from '@/components/Grid/Grid'
import { Notice } from '@/components/Notice/Notice'
import { PhotoCredit } from '@/components/PhotoCredit/PhotoCredit'
import { PhotoInfo } from '@/components/PhotoInfo/PhotoInfo'
import { type SectionId, SettingsPanel } from '@/components/SettingsPanel/SettingsPanel'
import { Welcome } from '@/components/Welcome/Welcome'
import { useLayout } from '@/layout/useLayout'
import { answerWelcome } from '@/onboarding/answerWelcome'
import type { SettingsStop } from '@/onboarding/callouts'
import { dismissNews } from '@/onboarding/dismissNews'
import { onboardingItem } from '@/onboarding/storage'
import { SETTINGS_TOUR } from '@/onboarding/tour'
import { useNews } from '@/onboarding/useNews'
import { preloadNext } from '@/photos/image'
import { usePhotoCatalog } from '@/photos/usePhotoCatalog'
import { usePhotoRotation } from '@/photos/usePhotoRotation'
import { fontStack } from '@/settings/fonts'
import { settingsItem } from '@/settings/storage'
import { useStorageItem } from '@/settings/useStorageItem'
import { usePruneReadings } from '@/widgets/Weather/usePruneReadings'
import type { PageValueName, PageValues } from '@/widgetSystem/definition'
import { pageValues } from '@/widgetSystem/fromSettings'
import { OptionsPopoverProvider } from '@/widgetSystem/useOptionsPopover'
import { RemovalProvider, useRemovalController } from '@/widgetSystem/useRemoval'

/** The popovers share the corner above the controls, so only one is open at a time. */
type Popover = 'info' | 'settings' | null

/**
 * How the settings were opened: on which section, and whether with the last stops of the tour
 * (where the tour has got to on the page, for the count).
 */
type SettingsEntry = {
  section: SectionId
  tour: { before: number; stops?: readonly SettingsStop[]; total: number } | false
}

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
  const background = useBackground(saveOutcome)
  // The Layout is the stored one, or worked out from the settings while there is none. Only
  // right once the stored settings have loaded, as the hook starts from the defaults.
  const {
    commit,
    layout,
    loaded: layoutLoaded,
    readOnly: layoutReadOnly,
  } = useLayout(settings, saveOutcome)
  // Readings no Weather uses are forgotten once both are known: before that the Layout is the
  // one worked out from the defaults, which has no Weather. Read-only settings count as well as
  // a read-only Layout: with no Layout stored, newer settings are read as the defaults, and a
  // newer device may have a Weather. A local clean-up: it writes nothing to the synced storage,
  // and nothing to the Layout.
  // Taking a Widget out and putting it back. Its Undo is the page's one notice, below.
  const removal = useRemovalController({
    commit,
    layout,
    loaded: settingsLoaded && layoutLoaded,
    readOnly: layoutReadOnly,
    saveFailures,
  })
  usePruneReadings(layout, {
    loaded: settingsLoaded && layoutLoaded,
    readOnly: layoutReadOnly || settingsReadOnly,
  })
  const [onboarding, setOnboarding] = useStorageItem(onboardingItem, saveOutcome)
  const [popover, setPopover] = useState<Popover>(null)
  const [entry, setEntry] = useState<SettingsEntry>(FROM_GEAR)
  const [photoLoading, setPhotoLoading] = useState(false)
  // Whether the guided tour of the page is running: started by the welcome's "Show me around", in
  // this tab only. Nothing about it is stored; the welcome's answer is the one thing written.
  const [touring, setTouring] = useState(false)
  const [walkingNews, setWalkingNews] = useState(false)
  const [quietInfo, setQuietInfo] = useState(false)
  const [previewColour, setPreviewColour] = useState<string | null>(null)
  // Wait for the stored settings: the fallback is every-visit, which would move the photo on
  // in every new tab regardless of the setting.
  const photoBackground = background.loaded && displayKind(background.value) === 'photo'
  const { next, photo, photos, upcoming } = usePhotoRotation(
    settingsLoaded && photoBackground ? settings.photos : null,
  )
  const catalog = usePhotoCatalog(popover === 'settings' && !photoBackground)
  const availablePhotos = photoBackground ? photos : catalog

  const toggle = (which: Exclude<Popover, null>) => {
    setQuietInfo(false)
    setPopover((open) => (open === which ? null : which))
  }
  const close = useCallback(() => {
    setQuietInfo(false)
    setPopover(null)
  }, [])
  const openSettings = (how: SettingsEntry) => {
    setEntry(how)
    setPopover('settings')
  }

  // Opening the settings ends the tour of the page (its last stops come to the panel by
  // `onFinish` below, which has ended it already).
  useEffect(() => {
    if (popover === 'settings') setTouring(false)
  }, [popover])

  useEffect(() => {
    if (!photoBackground && popover === 'info') setPopover(null)
  }, [photoBackground, popover])

  // Out of the way while a popover has the corner, and until the welcome has been answered.
  // A note at a thing on the page is placed by the Layout, so it waits for it as the Grid does.
  // Not alongside the tour, which is the one note a new install sees.
  const news = useNews(
    (popover === null || (walkingNews && popover === 'info')) && layoutLoaded && !touring
      ? onboarding
      : null,
    settingsLoaded ? settings : null,
  )
  const dismiss = (id: string) => {
    if (onboarding) setOnboarding(dismissNews(onboarding, id))
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

  // The shared 24-hour switch in a Widget's options is the page's `clock.hour12`: the one setting
  // a Widget's options write, and the one phase 2 may write to the settings' Clock block. Laid
  // over the settings as stored now, so what another tab changed meanwhile is not saved over.
  const setPageValue = <N extends PageValueName>(name: N, value: PageValues[N]) => {
    void (async () => {
      if (settingsReadOnly) return
      const latest = await settingsItem.getValue()
      setSettings({ ...latest, clock: { ...latest.clock, [name]: value } })
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
    <EditModeProvider canChange={!layoutReadOnly}>
      <AddMenuControlProvider>
        <main
          class="app"
          data-ink={
            photoBackground
              ? 'light'
              : background.loaded
                ? readableInk(previewColour ?? background.value.colour) === '#111'
                  ? 'dark'
                  : 'light'
                : undefined
          }
        >
          {background.loaded && !photoBackground && (
            <Background colour={previewColour ?? background.value.colour} />
          )}
          {photoBackground && photo && (
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
          News is before the Grid and the Bottom bar in the document, so a keyboard comes to it
          first; it takes no focus when it appears. One about the settings sits at a fixed spot
          (`callout--<section>`). One about a thing on the page is placed beside it by script and
          is not drawn while the thing is not there, so it is placed again when the Layout moves
          it. Whatever it does, it does not touch the Layout.
        */}
          {news?.section !== undefined && (
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
              key={news.id}
              onDismiss={() => dismiss(news.id)}
              title={news.title}
            />
          )}
          {news?.target !== undefined && (
            <PageNews
              closeInfo={() => {
                setQuietInfo(false)
                setPopover((open) => (open === 'info' ? null : open))
              }}
              dismiss={dismiss}
              layout={layout}
              news={news}
              onWalkChange={setWalkingNews}
              openInfo={() => {
                setQuietInfo(true)
                setPopover('info')
              }}
              openSettings={(section, tour) => openSettings({ section, tour })}
            />
          )}
          {/*
          The guided tour of the page, in the same place in the document as the news, so with the
          same Tab order; its notes take no focus either. It waits for the Layout, as the news
          does, and for the settings: the stops it has depend on what the Grid draws.
        */}
          {touring && settingsLoaded && layoutLoaded && popover !== 'settings' && (
            <PageTour
              closeInfo={() => {
                setQuietInfo(false)
                setPopover((open) => (open === 'info' ? null : open))
              }}
              layout={layout}
              onEnd={() => setTouring(false)}
              onFinish={(plan) => {
                setTouring(false)
                openSettings({
                  section: 'photos',
                  tour: { before: plan.page.length, total: plan.total },
                })
              }}
              openInfo={() => {
                setQuietInfo(true)
                setPopover('info')
              }}
            />
          )}
          {/*
          Stored settings and the stored Layout land a beat after the first paint. Drawing the
          defaults and then correcting them is a visible jolt — a clock that jumps fonts, say —
          and the Layout worked out from the defaults would put the wrong Widgets in the wrong
          places, so anything that depends on them waits for both. The photo already does:
          usePhotoRotation is held back until the settings are known.
        */}
          <OptionsPopoverProvider
            commit={commit}
            layout={layout}
            loaded={settingsLoaded && layoutLoaded}
            onOpen={close}
            onPageValueChange={setPageValue}
            // The corner above the controls is for one popover at a time; this one sits by its Widget.
            otherOpen={popover !== null}
            page={pageValues(settings)}
            pageValuesDisabled={!settingsLoaded || settingsReadOnly}
          >
            <RemovalProvider value={removal.controls}>
              {settingsLoaded && layoutLoaded && (
                <Grid commit={commit} layout={layout} page={pageValues(settings)} />
              )}
            </RemovalProvider>
          </OptionsPopoverProvider>
          {photoBackground && photo && <PhotoCredit photo={photo} />}
          {photoBackground && photo && popover === 'info' && (
            <PhotoInfo onClose={close} photo={photo} quiet={quietInfo} saveOutcome={saveOutcome} />
          )}
          {popover === 'settings' && (
            <SettingsPanel
              background={background.value}
              backgroundLoaded={background.loaded}
              backgroundReadOnly={background.readOnly}
              currentId={photoBackground ? (photo?.id ?? null) : null}
              initialSection={entry.section}
              onBackgroundChange={background.set}
              onChange={setSettings}
              onClose={close}
              onPreviewColour={setPreviewColour}
              photos={availablePhotos}
              readOnly={settingsReadOnly}
              saveOutcome={saveOutcome}
              settings={settings}
              tour={entry.tour ? (entry.tour.stops ?? SETTINGS_TOUR) : undefined}
              tourProgress={entry.tour || undefined}
            />
          )}
          {onboarding && !onboarding.welcomed && (
            <Welcome
              onSkip={() => setOnboarding(answerWelcome(onboarding))}
              onTour={() => {
                setOnboarding(answerWelcome(onboarding))
                setTouring(true)
              }}
            />
          )}
          {/* One notice, one live region: a refused save outranks a Widget that can be put back. */}
          <Notice
            {...(saveFailed || removal.notice === null
              ? {
                  message: saveFailed ? "Couldn't save that. Try again in a minute." : null,
                  onDismiss: () => setSaveFailed(false),
                }
              : removal.notice)}
          />
          <Controls
            busy={photoLoading}
            infoOpen={popover === 'info'}
            layout={layout}
            layoutLoaded={settingsLoaded && layoutLoaded}
            onCommit={commit}
            onNext={photoBackground ? showNext : undefined}
            onToggleInfo={photoBackground && photo ? () => toggle('info') : undefined}
            onToggleSettings={() => {
              setEntry(FROM_GEAR)
              toggle('settings')
            }}
            settingsOpen={popover === 'settings'}
          />
        </main>
      </AddMenuControlProvider>
    </EditModeProvider>
  )
}
