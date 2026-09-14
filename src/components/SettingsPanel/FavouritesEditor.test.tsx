import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { MAX_FAVOURITES, type Favourite } from '@/favourites/schema'

import { FavouritesEditor } from './FavouritesEditor'

const favourites: Favourite[] = [
  { id: '1', title: 'Portfolio', url: 'https://logankuzyk.com/' },
  { id: '2', title: 'Docs', url: 'https://example.com/' },
]

const renderEditor = (items: Favourite[] = favourites) => {
  const onChange = vi.fn()
  render(<FavouritesEditor favourites={items} onChange={onChange} />)
  return { onChange }
}

describe('FavouritesEditor', () => {
  it('adds a site, defaulting the name to the hostname', () => {
    const { onChange } = renderEditor([])

    fireEvent.input(screen.getByLabelText('Site address'), { target: { value: 'logankuzyk.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add site' }))

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0]?.[0]).toMatchObject([
      { title: 'logankuzyk.com', url: 'https://logankuzyk.com/' },
    ])
  })

  it('keeps a name that was typed in', () => {
    const { onChange } = renderEditor([])

    fireEvent.input(screen.getByLabelText('Site address'), { target: { value: 'logankuzyk.com' } })
    fireEvent.input(screen.getByLabelText('Name (optional)'), { target: { value: 'Portfolio' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add site' }))

    expect(onChange.mock.calls[0]?.[0]).toMatchObject([{ title: 'Portfolio' }])
  })

  it('explains an address it cannot use, and adds nothing', () => {
    const { onChange } = renderEditor([])

    fireEvent.input(screen.getByLabelText('Site address'), { target: { value: 'not a url' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add site' }))

    expect(screen.getByRole('alert').textContent).toContain('Enter a site address')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses to go past the cap', () => {
    const full = Array.from({ length: MAX_FAVOURITES }, (_, index) => ({
      id: String(index),
      title: `Site ${index}`,
      url: `https://site${index}.com/`,
    }))
    const { onChange } = renderEditor(full)

    fireEvent.input(screen.getByLabelText('Site address'), { target: { value: 'one-more.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add site' }))

    expect(screen.getByRole('alert').textContent).toContain(`up to ${MAX_FAVOURITES} sites`)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renames a site', () => {
    const { onChange } = renderEditor()

    fireEvent.change(screen.getByLabelText('Name for Portfolio'), { target: { value: 'Photos' } })

    expect(onChange.mock.calls[0]?.[0]?.[0]).toMatchObject({ id: '1', title: 'Photos' })
  })

  it('changes an address', () => {
    const { onChange } = renderEditor()

    fireEvent.change(screen.getByLabelText('Address for Docs'), { target: { value: 'docs.dev' } })

    expect(onChange.mock.calls[0]?.[0]?.[1]).toMatchObject({ url: 'https://docs.dev/' })
  })

  it('removes a site', () => {
    const { onChange } = renderEditor()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Portfolio' }))

    expect(onChange.mock.calls[0]?.[0]).toMatchObject([{ id: '2' }])
  })

  it('reorders sites, with the ends disabled', () => {
    const { onChange } = renderEditor()

    expect(screen.getByRole('button', { name: 'Move Portfolio up' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: 'Move Docs down' })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: 'Move Docs up' }))

    expect(onChange.mock.calls[0]?.[0]?.map((f: Favourite) => f.id)).toEqual(['2', '1'])
  })

  it('explains an address it cannot use instead of silently keeping the old one', () => {
    const { onChange } = renderEditor()
    const address = screen.getByLabelText('Address for Docs') as HTMLInputElement

    fireEvent.change(address, { target: { value: 'not a url' } })

    expect(screen.getByRole('alert').textContent).toContain('Enter a site address')
    expect(onChange).not.toHaveBeenCalled()
    // The field goes back to what is actually stored, rather than showing an address that is not.
    expect(address.value).toBe('https://example.com/')
  })

  it('clears the complaint once a usable address is typed', () => {
    const { onChange } = renderEditor()
    const address = screen.getByLabelText('Address for Docs')

    fireEvent.change(address, { target: { value: 'not a url' } })
    fireEvent.change(address, { target: { value: 'docs.dev' } })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(onChange.mock.calls[0]?.[0]?.[1]).toMatchObject({ url: 'https://docs.dev/' })
  })

  it('captions both fields so the two boxes in a row can be told apart', () => {
    renderEditor()
    // Decorative: the inputs keep aria-labels that name their site.
    const captions = document.querySelectorAll('.favourites-editor__field > span')

    expect([...captions].map((caption) => caption.textContent)).toEqual([
      'Address',
      'Name',
      'Address',
      'Name',
      'Address',
      'Name',
    ])
    captions.forEach((caption) => expect(caption.getAttribute('aria-hidden')).toBe('true'))
  })
})
