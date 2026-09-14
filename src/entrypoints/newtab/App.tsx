import { useEffect, useState } from 'preact/hooks'

import { Background } from '@/components/Background/Background'
import { Controls } from '@/components/Controls/Controls'
import { preloadNext } from '@/photos/image'
import type { Frequency } from '@/photos/rotation'
import { usePhotoRotation } from '@/photos/usePhotoRotation'
import { formatTime } from '@/utils/time'
import { PhotoCredit } from '@/widgets/PhotoCredit/PhotoCredit'

// Hard-coded until the settings panel lands.
const FREQUENCY: Frequency = 'every-visit'

export function App() {
  const [now, setNow] = useState(() => new Date())
  const { photo, upcoming, next } = usePhotoRotation(FREQUENCY)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

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
      <time class="clock" dateTime={now.toISOString()}>
        {formatTime(now)}
      </time>
      {photo && <PhotoCredit photo={photo} />}
      <Controls onNext={next} />
    </main>
  )
}
