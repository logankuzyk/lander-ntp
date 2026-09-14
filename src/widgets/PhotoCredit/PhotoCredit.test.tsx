import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { makePhoto } from '@/test/fixtures'

import { PhotoCredit } from './PhotoCredit'

describe('PhotoCredit', () => {
  it('shows the location and links to the photo on logankuzyk.com', () => {
    const { container } = render(
      <PhotoCredit photo={makePhoto('a', { location: 'Victoria, British Columbia, Canada' })} />,
    )

    expect(container.textContent).toBe('Victoria, British Columbia, Canada·View on logankuzyk.com')
    expect(screen.getByRole('link', { name: 'View on logankuzyk.com' }).getAttribute('href')).toBe(
      'https://logankuzyk.com/photography/coast?photo=a',
    )
    expect(screen.queryByRole('link', { name: 'Buy a print' })).toBeNull()
  })

  it('links to prints only when the photo has a print URL', () => {
    render(<PhotoCredit photo={makePhoto('a', { printUrl: 'https://logankuzyk.com/prints/a' })} />)

    expect(screen.getByRole('link', { name: 'Buy a print' }).getAttribute('href')).toBe(
      'https://logankuzyk.com/prints/a',
    )
  })

  it('omits the location when there is none', () => {
    const { container } = render(<PhotoCredit photo={makePhoto('a')} />)

    expect(container.textContent).toBe('View on logankuzyk.com')
  })
})
