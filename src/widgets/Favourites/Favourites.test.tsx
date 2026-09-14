import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import type { Favourite } from '@/favourites/schema'

import { Favourites } from './Favourites'

const favourites: Favourite[] = [
  { id: '1', title: 'Portfolio', url: 'https://logankuzyk.com/' },
  { id: '2', title: 'Docs', url: 'https://example.com/' },
]

describe('Favourites', () => {
  it('renders nothing when there are no sites', () => {
    const { container } = render(<Favourites favourites={[]} style="list" size="m" />)
    expect(container.firstChild).toBeNull()
  })

  it('lists sites as links in a labelled landmark', () => {
    render(<Favourites favourites={favourites} style="list" size="m" />)

    expect(screen.getByRole('navigation', { name: 'Favourite sites' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Portfolio' }).getAttribute('href')).toBe(
      'https://logankuzyk.com/',
    )
  })

  it.each([
    ['list', 's'],
    ['list', 'l'],
    ['grid', 's'],
    ['grid', 'm'],
    ['grid', 'l'],
  ] as const)('marks up %s style at size %s', (style, size) => {
    render(<Favourites favourites={favourites} style={style} size={size} />)

    const nav = screen.getByRole('navigation', { name: 'Favourite sites' })
    expect(nav.classList.contains(`favourites--${style}`)).toBe(true)
    expect(nav.classList.contains(`is-${size}`)).toBe(true)
  })

  it('falls back to a monogram when the icon fails to load', () => {
    const { container } = render(<Favourites favourites={favourites} style="grid" size="m" />)
    const icon = container.querySelector('img.favourite__icon')

    expect(icon?.getAttribute('src')).toContain('_favicon')
    fireEvent.error(icon as Element)

    const monogram = container.querySelector('.favourite__icon--monogram')
    expect(monogram?.textContent).toBe('P')
  })
})
