import { fireEvent, render, screen } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { iconItem } from '@/quickDial/iconStorage'

vi.mock('@/quickDial/icon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/quickDial/icon')>()
  return { ...actual, encodeIcon: vi.fn(async () => 'data:image/webp;base64,YQ==') }
})

import { IconControl } from './IconControl'

beforeEach(async () => fakeBrowser.storage.sync.clear())

describe('Quick dial icon control', () => {
  it('keeps the old synced icon when the Layout refuses the uploaded icon', async () => {
    await iconItem('oldicon1').setValue({ data: 'data:image/webp;base64,Yg==', v: 1 })
    const onChange = vi.fn(async () => false)
    render(
      <IconControl disabled={false} onChange={onChange} siteIcon="/site.ico" value="oldicon1" />,
    )

    fireEvent.change(screen.getByLabelText('Upload an icon'), {
      target: { files: [new File(['source'], 'icon.png', { type: 'image/png' })] },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Use this icon' }))
    await screen.findByRole('alert')

    const stored = await fakeBrowser.storage.sync.get(null)
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^[a-z\d]{8}$/))
    expect(stored).toEqual({ 'icon:oldicon1': { data: 'data:image/webp;base64,Yg==', v: 1 } })
  })
})
