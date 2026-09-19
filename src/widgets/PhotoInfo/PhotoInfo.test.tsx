import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import type { Photo } from '@/photos/schema'
import { makePhoto } from '@/test/fixtures'

import { PhotoInfo } from './PhotoInfo'

const FULL_EXIF: Photo['exif'] = {
  camera: 'Canon, EOS R5',
  focalLength: '35.0mm',
  aperture: 'f/2.8',
  shutter: '1/250s',
  iso: 'ISO 400',
  dateTaken: '2025-06-30T12:26:01.000Z',
}

const rows = (container: ParentNode) =>
  [...container.querySelectorAll('.photo-info__row')].map((row) => [
    row.querySelector('dt')?.textContent,
    row.querySelector('dd')?.textContent,
  ])

const renderInfo = (photo: Photo) => {
  const onClose = vi.fn()
  const view = render(<PhotoInfo photo={photo} onClose={onClose} locale="en-GB" />)
  return { ...view, onClose }
}

describe('PhotoInfo', () => {
  it('shows every camera setting, with the date in the viewer’s locale', () => {
    const { container } = renderInfo(
      makePhoto('a', { exif: FULL_EXIF, location: 'Victoria, British Columbia, Canada' }),
    )

    expect(rows(container)).toEqual([
      ['Camera', 'Canon, EOS R5'],
      ['Focal length', '35.0mm'],
      ['Aperture', 'f/2.8'],
      ['Shutter', '1/250s'],
      ['ISO', 'ISO 400'],
      ['Taken', '30 June 2025'],
      ['Location', 'Victoria, British Columbia, Canada'],
    ])
  })

  it('leaves out what the photo does not have', () => {
    const { container } = renderInfo(
      makePhoto('a', { exif: { camera: 'FUJIFILM X-T5', iso: 'ISO 125' } }),
    )

    expect(rows(container)).toEqual([
      ['Camera', 'FUJIFILM X-T5'],
      ['ISO', 'ISO 125'],
    ])
  })

  it('says so when there are no camera details at all', () => {
    const { container } = renderInfo(makePhoto('a'))

    expect(rows(container)).toEqual([])
    expect(container.querySelector('.photo-info__empty')?.textContent).toBe(
      'No camera details for this photo.',
    )
  })

  it('ignores a date it cannot read', () => {
    const { container } = renderInfo(makePhoto('a', { exif: { dateTaken: 'not a date' } }))

    expect(rows(container)).toEqual([])
  })

  it('links to the photo, and to prints only when there are any', () => {
    renderInfo(makePhoto('a'))

    expect(screen.getByRole('link', { name: 'View on logankuzyk.com' }).getAttribute('href')).toBe(
      'https://logankuzyk.com/photography/coast?photo=a',
    )
    expect(screen.queryByRole('link', { name: 'Buy a print' })).toBeNull()
  })

  it('shows a print link when the photo has one', () => {
    renderInfo(makePhoto('a', { printUrl: 'https://logankuzyk.com/prints/a' }))

    expect(screen.getByRole('link', { name: 'Buy a print' })).toBeTruthy()
  })

  it('opens as a labelled dialog with the close button focused', () => {
    renderInfo(makePhoto('a'))

    expect(screen.getByRole('dialog', { name: 'Photo details' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close photo details' }))
  })

  it('closes with the button, with Escape and with a click outside', () => {
    const { onClose } = renderInfo(makePhoto('a'))

    fireEvent.click(screen.getByRole('button', { name: 'Close photo details' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.pointerDown(document.body)

    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('stays open for a click inside, or on a button that toggles it', () => {
    const { onClose } = renderInfo(makePhoto('a'))
    render(
      <button type="button" data-popover-toggle>
        Toggle
      </button>,
    )

    fireEvent.pointerDown(screen.getByRole('dialog').querySelector('dd, p') as Element)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Toggle' }))

    expect(onClose).not.toHaveBeenCalled()
  })
})
