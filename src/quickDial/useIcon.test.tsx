import { act, renderHook, waitFor } from '@testing-library/preact'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { iconItem } from './iconStorage'
import { useIcon } from './useIcon'

beforeEach(async () => fakeBrowser.storage.sync.clear())

describe('useIcon', () => {
  it('shows icon data that arrives through sync after the Quick dial is already drawn', async () => {
    const { result } = renderHook(() => useIcon('abcdefgh'))
    await waitFor(() => expect(result.current).toBeNull())

    await act(async () => {
      await iconItem('abcdefgh').setValue({ data: 'data:image/webp;base64,YQ==', v: 1 })
    })

    await waitFor(() => expect(result.current).toBe('data:image/webp;base64,YQ=='))
  })
})
