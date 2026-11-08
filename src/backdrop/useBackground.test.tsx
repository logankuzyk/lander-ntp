import { act, renderHook, waitFor } from '@testing-library/preact'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { BACKGROUND_HINT_KEY } from './paintHint'
import { DEFAULT_BACKGROUND } from './storage'
import { useBackground } from './useBackground'

describe('useBackground', () => {
  beforeEach(async () => {
    await fakeBrowser.storage.sync.clear()
    localStorage.clear()
  })

  it('persists the stored colour hint when the background is read and changed', async () => {
    const { result } = renderHook(() => useBackground())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(JSON.parse(localStorage.getItem(BACKGROUND_HINT_KEY) ?? '')).toMatchObject({
      colour: '#ffffff',
      kind: 'photo',
    })

    await act(async () =>
      result.current.set({ ...DEFAULT_BACKGROUND, colour: '#f2e8cf', kind: 'colour' }),
    )
    await waitFor(() => expect(localStorage.getItem(BACKGROUND_HINT_KEY)).toContain('#f2e8cf'))
    expect(JSON.parse(localStorage.getItem(BACKGROUND_HINT_KEY) ?? '')).toEqual({
      colour: '#f2e8cf',
      ink: '#111',
      kind: 'colour',
    })
  })
})
