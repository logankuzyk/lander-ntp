import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { checkIcon, deleteIcon, iconItem, saveIcon } from './iconStorage'

beforeEach(async () => fakeBrowser.storage.sync.clear())

describe('Quick dial icon storage', () => {
  it('keeps unknown keys and accepts a bounded PNG data URL', () => {
    const icon = checkIcon({ data: 'data:image/png;base64,YQ==', future: 'kept', v: 1 })
    expect(icon).toEqual({ data: 'data:image/png;base64,YQ==', future: 'kept', v: 1 })
  })

  it('refuses data that is not a bounded image data URL', () => {
    expect(checkIcon({ data: 'https://example.com/icon.png', v: 1 }).data).toBe('')
    expect(checkIcon({ data: `data:image/png;base64,${'A'.repeat(6_100)}`, v: 1 }).data).toBe('')
  })

  it('saves and deletes an icon under a fresh eight character id', async () => {
    const id = await saveIcon('data:image/webp;base64,YQ==')
    expect(id).toMatch(/^[a-z\d]{8}$/)
    expect((await iconItem(id).read()).value.data).toBe('data:image/webp;base64,YQ==')
    await deleteIcon(id)
    expect((await iconItem(id).read()).value.data).toBe('')
  })

  it('shows newer icon data read-only and refuses to overwrite it', async () => {
    await fakeBrowser.storage.sync.set({
      'icon:abcdefgh': { data: 'data:image/png;base64,YQ==', v: 2 },
    })
    const item = iconItem('abcdefgh')
    expect((await item.read()).newer).toBe(true)
    await expect(item.write({ data: 'data:image/png;base64,Yg==', v: 1 })).rejects.toThrow()
    expect((await fakeBrowser.storage.sync.get('icon:abcdefgh'))['icon:abcdefgh']).toMatchObject({
      v: 2,
    })
  })
})
