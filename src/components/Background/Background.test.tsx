import { act, fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makePhoto } from '@/test/fixtures'

import { Background } from './Background'

const MEDIA = 'https://media.logankuzyk.com/photos'

const layers = (container: ParentNode) => [
  ...container.querySelectorAll<HTMLElement>('.background__layer'),
]
const fulls = (container: ParentNode) => [
  ...container.querySelectorAll<HTMLImageElement>('.background__full'),
]

describe('Background', () => {
  it('shows the blurred thumbnail, then fades in the full image once it loads', () => {
    const onLoad = vi.fn()
    const photo = makePhoto('a', { alt: 'Sunset over the Olympics', focalX: 30, focalY: 70 })
    const { container } = render(<Background photo={photo} onLoad={onLoad} />)

    const thumbnail = container.querySelector('.background__thumb')
    const full = screen.getByRole('img', { name: 'Sunset over the Olympics' })

    expect(thumbnail?.getAttribute('src')).toBe(`${MEDIA}/a/pic-300.webp`)
    expect(full.getAttribute('srcset')).toBe(
      `${MEDIA}/a/pic-300.webp 300w, ${MEDIA}/a/pic-1920.webp 1920w`,
    )
    expect(full.getAttribute('sizes')).toBe('100vw')
    expect(full.getAttribute('src')).toBe(`${MEDIA}/a/pic-1920.webp`)
    expect(full.style.objectPosition).toBe('30% 70%')
    expect(full.classList.contains('is-loaded')).toBe(false)

    fireEvent.load(full)

    expect(full.classList.contains('is-loaded')).toBe(true)
    expect(onLoad).toHaveBeenCalledOnce()
  })

  it('treats a photo without alt text as decorative', () => {
    const { container } = render(<Background photo={makePhoto('a', { alt: null })} />)
    const images = container.querySelectorAll('img')

    expect(images).toHaveLength(2)
    images.forEach((image) => expect(image.getAttribute('alt')).toBe(''))
  })

  it('falls back to the bundled photo when the image fails to load', () => {
    // A cached manifest can outlive the images it points at.
    const onLoad = vi.fn()
    const { container } = render(<Background photo={makePhoto('a')} onLoad={onLoad} />)

    const full = () => fulls(container)[0] as HTMLImageElement
    fireEvent.error(full())

    expect(full().getAttribute('src')).toMatch(/\/fallback\.webp$/)
    expect(full().getAttribute('srcset')).toBeNull()
    expect(full().classList.contains('is-loaded')).toBe(false)
    // The blurred thumbnail came from the same dead manifest entry.
    expect(container.querySelector('.background__thumb')).toBeNull()

    fireEvent.load(full())

    expect(full().classList.contains('is-loaded')).toBe(true)
    // The next photo is only worth preloading if the current one actually rendered.
    expect(onLoad).not.toHaveBeenCalled()
  })

  describe('changing photo', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('holds the old photo until the new one has loaded, then cross-fades', () => {
      const { container, rerender } = render(<Background photo={makePhoto('a')} />)
      fireEvent.load(fulls(container)[0] as HTMLImageElement)

      rerender(<Background photo={makePhoto('b')} />)

      // The incoming photo waits on top, transparent, so the page never drops back to a
      // blurred placeholder while it loads.
      expect(layers(container)).toHaveLength(2)
      const incoming = layers(container)[1] as HTMLElement
      expect(incoming.classList.contains('background__layer--cover')).toBe(true)
      expect(incoming.classList.contains('is-visible')).toBe(false)
      expect(incoming.querySelector('.background__thumb')).toBeNull()

      fireEvent.load(incoming.querySelector('.background__full') as HTMLImageElement)

      expect(incoming.classList.contains('is-visible')).toBe(true)
    })

    it('drops the photo underneath once the cross-fade has finished', () => {
      const { container, rerender } = render(<Background photo={makePhoto('a')} />)
      fireEvent.load(fulls(container)[0] as HTMLImageElement)
      rerender(<Background photo={makePhoto('b')} />)
      fireEvent.load(fulls(container)[1] as HTMLImageElement)

      expect(layers(container)).toHaveLength(2)

      act(() => {
        vi.runAllTimers()
      })

      expect(layers(container)).toHaveLength(1)
      expect(fulls(container)[0]?.getAttribute('src')).toBe(`${MEDIA}/b/pic-1920.webp`)
    })

    it('stacks a photo that arrives mid-fade rather than losing it', () => {
      const { container, rerender } = render(<Background photo={makePhoto('a')} />)
      rerender(<Background photo={makePhoto('b')} />)
      rerender(<Background photo={makePhoto('c')} />)

      expect(layers(container)).toHaveLength(3)

      // Only the topmost photo settling clears the stack.
      fireEvent.load(fulls(container)[2] as HTMLImageElement)
      act(() => {
        vi.runAllTimers()
      })

      expect(layers(container)).toHaveLength(1)
      expect(fulls(container)[0]?.getAttribute('src')).toBe(`${MEDIA}/c/pic-1920.webp`)
    })

    it('reports the wait while the replacement photo loads', () => {
      const onLoadingChange = vi.fn()
      const { container, rerender } = render(
        <Background photo={makePhoto('a')} onLoadingChange={onLoadingChange} />,
      )
      fireEvent.load(fulls(container)[0] as HTMLImageElement)
      onLoadingChange.mockClear()

      rerender(<Background photo={makePhoto('b')} onLoadingChange={onLoadingChange} />)

      expect(onLoadingChange).toHaveBeenLastCalledWith(true)

      fireEvent.load(fulls(container)[1] as HTMLImageElement)

      expect(onLoadingChange).toHaveBeenLastCalledWith(false)
    })

    it('never reports a wait for the first photo, which shows its thumbnail', () => {
      const onLoadingChange = vi.fn()
      render(<Background photo={makePhoto('a')} onLoadingChange={onLoadingChange} />)

      expect(onLoadingChange).not.toHaveBeenCalledWith(true)
    })

    it('clears the wait when it unmounts mid-load', () => {
      const onLoadingChange = vi.fn()
      const { container, rerender, unmount } = render(
        <Background photo={makePhoto('a')} onLoadingChange={onLoadingChange} />,
      )
      fireEvent.load(fulls(container)[0] as HTMLImageElement)
      rerender(<Background photo={makePhoto('b')} onLoadingChange={onLoadingChange} />)
      expect(onLoadingChange).toHaveBeenLastCalledWith(true)

      unmount()

      expect(onLoadingChange).toHaveBeenLastCalledWith(false)
    })

    it('ignores a re-render that keeps the same photo', () => {
      const { container, rerender } = render(<Background photo={makePhoto('a')} />)

      rerender(<Background photo={makePhoto('a', { alt: 'Same photo' })} />)

      expect(layers(container)).toHaveLength(1)
    })
  })
})
