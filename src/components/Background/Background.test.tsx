import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { makePhoto } from '@/test/fixtures'

import { Background } from './Background'

const MEDIA = 'https://media.logankuzyk.com/photos/a'

describe('Background', () => {
  it('shows the blurred thumbnail, then fades in the full image once it loads', () => {
    const onLoad = vi.fn()
    const photo = makePhoto('a', { alt: 'Sunset over the Olympics', focalX: 30, focalY: 70 })
    const { container } = render(<Background photo={photo} onLoad={onLoad} />)

    const thumbnail = container.querySelector('.background__thumb')
    const full = screen.getByRole('img', { name: 'Sunset over the Olympics' })

    expect(thumbnail?.getAttribute('src')).toBe(`${MEDIA}/pic-300.webp`)
    expect(full.getAttribute('srcset')).toBe(
      `${MEDIA}/pic-300.webp 300w, ${MEDIA}/pic-1920.webp 1920w`,
    )
    expect(full.getAttribute('sizes')).toBe('100vw')
    expect(full.getAttribute('src')).toBe(`${MEDIA}/pic-1920.webp`)
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
})
