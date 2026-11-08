import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'

import { QuickDial } from './QuickDial'

describe('Quick dial', () => {
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
