import { renderHook, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS } from '@/settings/schema'

import type { CalloutInfo } from './callouts'
import type { Onboarding } from './storage'
import { useNews } from './useNews'

// `callouts.ts` has no news at the moment (see callouts.test.ts), so these bring their own.
const news = vi.hoisted(() => ({ current: [] as CalloutInfo[] }))
vi.mock('./callouts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./callouts')>()),
  get NEWS() {
    return news.current
  },
}))

const FIRST: CalloutInfo = { body: 'One.', id: 'first', target: 'edit', title: 'First' }
const SECOND: CalloutInfo = { body: 'Two.', id: 'second', target: 'add', title: 'Second' }

const seen = (...dismissed: string[]): Onboarding => ({ dismissed, welcomed: true })

/** Long enough for the availability check to have answered. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('useNews', () => {
  it('shows the first one not yet dismissed, once the welcome has been answered', async () => {
    news.current = [FIRST, SECOND]

    const { result } = renderHook(() => useNews(seen(), DEFAULT_SETTINGS))
    const welcoming = renderHook(() =>
      useNews({ dismissed: [], welcomed: false }, DEFAULT_SETTINGS),
    )

    await waitFor(() => expect(result.current?.id).toBe('first'))
    expect(welcoming.result.current).toBeNull()
  })

  it('goes on to the next once one is dismissed', async () => {
    news.current = [FIRST, SECOND]

    const { result } = renderHook(() => useNews(seen('first'), DEFAULT_SETTINGS))

    await waitFor(() => expect(result.current?.id).toBe('second'))
  })

  it('is not troubled by dismissed ids that no entry has, such as the removed weather one', async () => {
    news.current = [FIRST]

    const { result } = renderHook(() => useNews(seen('weather'), DEFAULT_SETTINGS))

    await waitFor(() => expect(result.current?.id).toBe('first'))
  })

  it('shows nothing when everything has been seen, ids it does not know included', async () => {
    news.current = [FIRST]

    const { result } = renderHook(() => useNews(seen('weather', 'first'), DEFAULT_SETTINGS))

    await settle()
    expect(result.current).toBeNull()
  })

  it('shows nothing while there is no news at all', async () => {
    news.current = []

    const { result } = renderHook(() => useNews(seen(), DEFAULT_SETTINGS))

    await settle()
    expect(result.current).toBeNull()
  })

  it('skips one with nothing left to point out', async () => {
    news.current = [{ ...FIRST, relevant: () => false }, SECOND]

    const { result } = renderHook(() => useNews(seen(), DEFAULT_SETTINGS))

    await waitFor(() => expect(result.current?.id).toBe('second'))
  })

  it('holds the others back while one is unavailable, so they keep their order', async () => {
    news.current = [{ ...FIRST, available: () => Promise.resolve(false) }, SECOND]

    const { result } = renderHook(() => useNews(seen(), DEFAULT_SETTINGS))

    await settle()
    expect(result.current).toBeNull()
  })
})
