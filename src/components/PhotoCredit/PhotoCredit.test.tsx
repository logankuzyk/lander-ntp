import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { makePhoto } from '@/test/fixtures'

import { PhotoCredit } from './PhotoCredit'

describe('PhotoCredit', () => {
  it('shows the location', () => {
    const { container } = render(
      <PhotoCredit photo={makePhoto('a', { location: 'Victoria, British Columbia, Canada' })} />,
    )

    expect(container.textContent).toBe('Victoria, British Columbia, Canada')
  })

  it('leaves the link to the photo page to the details panel', () => {
    render(
      <PhotoCredit photo={makePhoto('a', { location: 'Victoria, British Columbia, Canada' })} />,
    )

    expect(screen.queryByRole('link', { name: 'View on logankuzyk.com' })).toBeNull()
  })

  it('links to prints only when the photo has a print URL', () => {
    render(
      <PhotoCredit
        photo={makePhoto('a', {
          location: 'Tofino, BC',
          printUrl: 'https://logankuzyk.com/prints/a',
        })}
      />,
    )

    expect(screen.getByRole('link', { name: 'Buy a print' }).getAttribute('href')).toBe(
      'https://logankuzyk.com/prints/a',
    )
    expect(screen.getByText('Tofino, BC')).toBeTruthy()
  })

  it('renders nothing when the photo has neither a location nor prints', () => {
    // Without the site link there is no longer anything to fall back to.
    const { container } = render(<PhotoCredit photo={makePhoto('a')} />)

    expect(container.querySelector('.credit')).toBeNull()
  })
})
