import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'

import { QuickDial } from './QuickDial'

describe('Quick dial', () => {
  it('shows its uploaded icon first and falls back to the site icon if it fails', () => {
    const { container } = render(
      <QuickDial
        iconUrl={() => '/site.ico'}
        label="Example"
        newTab={false}
        uploadedIcon="data:image/webp;base64,YQ=="
        url="example.com"
      />,
    )
    const image = container.querySelector('img')!
    expect(image.getAttribute('src')).toBe('data:image/webp;base64,YQ==')

    fireEvent.error(image)

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/site.ico')
  })

  it('uses a site icon first and shows the host initial after it fails', () => {
    const { container } = render(
      <QuickDial iconUrl={() => '/stub.ico'} label="" newTab={false} url="example.com" />,
    )
    const image = container.querySelector('img')!
    expect(image.getAttribute('src')).toBe('/stub.ico')
    expect(image.getAttribute('referrerpolicy')).toBe('no-referrer')
    fireEvent.error(image)
    expect(screen.getByText('E')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
  })

  it('does not put a generated colour behind a site favicon', () => {
    const { container } = render(
      <QuickDial iconUrl={() => '/stub.ico'} label="Example" newTab={false} url="example.com" />,
    )

    expect(container.querySelector('.quick-dial__icon')?.getAttribute('style')).toBeNull()
  })

  it('uses the chosen colour when neither the uploaded icon nor site favicon loads', () => {
    const { container } = render(
      <QuickDial
        colour="#e63946"
        iconUrl={() => '/site.ico'}
        label="Example"
        newTab={false}
        uploadedIcon="data:image/webp;base64,YQ=="
        url="example.com"
      />,
    )

    fireEvent.error(container.querySelector('img')!)
    fireEvent.error(container.querySelector('img')!)

    expect(container.querySelector('.quick-dial__icon')?.getAttribute('style')).toContain('#e63946')
    expect(screen.getByText('E')).toBeTruthy()
  })

  it('shows only the label when its icon is turned off', () => {
    const iconUrl = vi.fn(() => '/site.ico')
    const { container } = render(
      <QuickDial
        iconUrl={iconUrl}
        label="Example"
        newTab={false}
        showIcon={false}
        url="example.com"
      />,
    )

    expect(container.querySelector('.quick-dial__icon')).toBeNull()
    expect(screen.getByRole('link', { name: 'Example' }).textContent).toBe('Example')
    expect(iconUrl).not.toHaveBeenCalled()
  })

  it('resets a failed icon when the site changes', () => {
    const { container, rerender } = render(
      <QuickDial iconUrl={(host) => `/${host}.ico`} label="" newTab={false} url="example.com" />,
    )
    fireEvent.error(container.querySelector('img')!)
    rerender(
      <QuickDial iconUrl={(host) => `/${host}.ico`} label="" newTab={false} url="other.com" />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/other.com.ico')
  })

  it('uses the host when the label contains only whitespace', () => {
    render(<QuickDial iconUrl={() => '/stub.ico'} label="   " newTab={false} url="example.com" />)

    expect(screen.getByRole('link', { name: 'example.com' }).textContent).toBe('example.com')
  })

  it('opens in a new tab without sending a referrer when selected', () => {
    render(<QuickDial iconUrl={() => '/stub.ico'} label="Example" newTab url="example.com" />)
    const link = screen.getByRole('link', { name: 'Example' })

    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  it('does not navigate on click or Enter in Edit mode', () => {
    function EnterEdit() {
      const { enter } = useEditMode()
      return <button onClick={enter}>edit</button>
    }
    render(
      <EditModeProvider>
        <EnterEdit />
        <QuickDial label="Example" newTab={false} url="example.com" />
      </EditModeProvider>,
    )
    fireEvent.click(screen.getByText('edit'))
    const link = screen.getByRole('link', { name: 'Example' })
    expect(fireEvent.click(link)).toBe(false)
    expect(fireEvent.keyDown(link, { key: 'Enter' })).toBe(false)
  })
})
