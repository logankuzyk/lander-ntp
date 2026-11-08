import { useEffect, useMemo, useState } from 'preact/hooks'

import { iconItem } from './iconStorage'

/** Watches one synced icon item so data arriving on another device appears without a reload. */
export function useIcon(id: string | null): string | null {
  const item = useMemo(() => (id ? iconItem(id) : null), [id])
  const [data, setData] = useState<string | null>(null)
  useEffect(() => {
    if (!item) {
      setData(null)
      return
    }
    let active = true
    void item.read().then((value) => active && setData(value.value.data || null))
    const unwatch = item.watch((value) => active && setData(value?.data || null))
    return () => {
      active = false
      unwatch()
    }
  }, [item])
  return data
}
