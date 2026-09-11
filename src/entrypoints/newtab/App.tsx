import { useEffect, useState } from 'preact/hooks'

import { formatTime } from '@/utils/time'

export function App() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <main class="app">
      <time class="clock" dateTime={now.toISOString()}>
        {formatTime(now)}
      </time>
    </main>
  )
}
