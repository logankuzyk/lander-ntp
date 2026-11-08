import { afterEach, describe, expect, it, vi } from 'vitest'

import { canvasIconEncoder, encodeIcon, ICON_DATA_URL_LIMIT } from './icon'
import type { IconEncoder } from './icon'

const webp = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/webp' })
const encoder: IconEncoder = { encode: vi.fn(async () => webp(100)) }

const file = (type = 'image/jpeg') => new File(['source'], 'source.jpg', { type })

describe('encodeIcon', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('encodes the whole image as a 64 pixel WebP icon and returns a data URL', async () => {
    const encode = vi.fn(async () => webp(100))
    const source = file()
    const result = await encodeIcon(source, { encode })
    expect(encode).toHaveBeenCalledWith(source, 64, 'image/webp', 0.8)
    expect(result).toMatch(/^data:image\/webp;base64,/)
  })

  it('rejects a non-image file in plain words', async () => {
    await expect(encodeIcon(file('text/plain'), encoder)).rejects.toThrow('Choose an image file.')
  })

  it('rejects data URLs over the sync item limit', async () => {
    const tooBig = new Blob([new Uint8Array(ICON_DATA_URL_LIMIT)], { type: 'image/webp' })
    await expect(encodeIcon(file(), { encode: async () => tooBig })).rejects.toThrow(
      'This icon is too big.',
    )
  })

  it('accepts a bounded PNG fallback when WebP encoding is unavailable', async () => {
    const png = new Blob(['small'], { type: 'image/png' })
    await expect(encodeIcon(file(), { encode: async () => png })).resolves.toMatch(
      /^data:image\/png;base64,/,
    )
  })

  it('rejects an oversized PNG fallback with a browser encoding message', async () => {
    const png = new Blob([new Uint8Array(ICON_DATA_URL_LIMIT)], { type: 'image/png' })
    await expect(encodeIcon(file(), { encode: async () => png })).rejects.toThrow(
      "This browser can't make this image small enough for sync.",
    )
  })

  it('fits a wide image inside the square and leaves transparent padding above and below', async () => {
    const image = { close: vi.fn(), height: 64, width: 128 }
    const drawImage = vi.fn()
    const canvas = {
      getContext: () => ({ drawImage }),
      toBlob: (done: BlobCallback) => done(new Blob(['icon'], { type: 'image/webp' })),
    }
    vi.stubGlobal('createImageBitmap', async () => image)
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement)

    await canvasIconEncoder.encode(file(), 64, 'image/webp', 0.8)

    expect(drawImage).toHaveBeenCalledWith(image, 0, 16, 64, 32)
    expect(image.close).toHaveBeenCalledOnce()
  })
})
