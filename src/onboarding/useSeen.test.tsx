import { act, renderHook, waitFor } from '@testing-library/preact'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { onboardingItem, pendingItem } from './storage'
import { recordSeen, useSeen } from './useSeen'

describe('useSeen', () => {
  beforeEach(async () => {
    await fakeBrowser.storage.sync.clear()
    await pendingItem.setValue(null)
  })

  it('shows an unseen mark and records it without losing other onboarding ids', async () => {
    await onboardingItem.setValue({ dismissed: ['layout'], welcomed: true })

    const { result } = renderHook(() => useSeen('new-widget'))
    await waitFor(() => expect(result.current.seen).toBe(false))

    await act(async () => result.current.markSeen())

    expect(await onboardingItem.getValue()).toEqual({
      dismissed: ['layout', 'new-widget'],
      welcomed: true,
    })

    const secondDevice = renderHook(() => useSeen('new-widget'))
    await waitFor(() => expect(secondDevice.result.current.seen).toBe(true))
  })

  it('keeps both IDs when separate surfaces record marks concurrently', async () => {
    await onboardingItem.setValue({ dismissed: ['layout'], welcomed: true })

    await Promise.all([recordSeen(['photos']), recordSeen(['photo-heart'])])

    expect(await onboardingItem.getValue()).toEqual({
      dismissed: ['layout', 'photos', 'photo-heart'],
      welcomed: true,
    })
  })

  it('waits for onboarding instead of treating an unrecorded ID as seen', async () => {
    const { result } = renderHook(() => useSeen('photos'))

    await waitFor(() => expect(result.current.seen).toBeNull())
    await act(async () => onboardingItem.setValue({ dismissed: [], welcomed: true }))

    await waitFor(() => expect(result.current.seen).toBe(false))
  })
})
