import { useEffect, useState } from 'preact/hooks'

import { Background } from '@/components/Background/Background'
import { Controls } from '@/components/Controls/Controls'
import { SettingsPanel } from '@/components/SettingsPanel/SettingsPanel'
import { favouritesItem } from '@/favourites/storage'
import { preloadNext } from '@/photos/image'
import { usePhotoRotation } from '@/photos/usePhotoRotation'
import { FONTS } from '@/settings/fonts'
import { settingsItem } from '@/settings/storage'
import { useStorageItem } from '@/settings/useStorageItem'
import { Clock } from '@/widgets/Clock/Clock'
import { Favourites } from '@/widgets/Favourites/Favourites'
import { PhotoCredit } from '@/widgets/PhotoCredit/PhotoCredit'

export function App() {
  const [settings, setSettings] = useStorageItem(settingsItem)
  const [favourites, setFavourites] = useStorageItem(favouritesItem)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { photo, upcoming, next } = usePhotoRotation(settings.frequency)

  useEffect(() => {
    document.documentElement.style.setProperty('--font-display', FONTS[settings.font].stack)
  }, [settings.font])

  return (
    <main class="app">
      {photo && (
        <Background
          key={photo.id}
          photo={photo}
          onLoad={() => {
            if (upcoming) preloadNext(upcoming)
          }}
        />
      )}
      {settings.favourites.enabled && (
        <Favourites
          favourites={favourites}
          style={settings.favourites.style}
          size={settings.favourites.size}
        />
      )}
      {settings.clock.enabled && <Clock {...settings.clock} />}
      {photo && settings.widgets.credit && <PhotoCredit photo={photo} />}
      <Controls onNext={next} onOpenSettings={() => setSettingsOpen(true)} />
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          favourites={favourites}
          onFavouritesChange={setFavourites}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  )
}
