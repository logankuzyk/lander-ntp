import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { accessibleName } from '@/widgetSystem/name'
import { readOptions } from '@/widgetSystem/options'
import { OptionsForm } from '@/widgetSystem/OptionsForm'
import { WidgetBox } from '@/widgetSystem/WidgetBox'

import { quickDialDefinition } from './definition'

const PAGE = { hour12: false }
const RECT = { col: 1, h: 1, row: 1, w: 1 }

describe('the Quick dial definition', () => {
  it('counts each site as one Widget and starts at one cell', () => {
    expect(quickDialDefinition.type).toBe('quick-dial')
    expect(quickDialDefinition.name).toBe('Quick dial')
    expect(quickDialDefinition.sizes).toMatchObject({
      largest: { h: 3, w: 3 },
      smallest: { h: 1, w: 1 },
      starting: expect.any(Function),
    })
    expect(
      quickDialDefinition.sizes.starting({
        colour: '#ffffff',
        icon: null,
        label: '',
        newTab: false,
        showIcon: true,
        url: '',
      }),
    ).toEqual({ h: 1, w: 1 })
  })

  it('uses the label or host as its summary and treats an unsafe stored URL as unset', () => {
    expect(
      quickDialDefinition.summary?.({
        colour: '#ffffff',
        icon: null,
        label: '',
        newTab: false,
        showIcon: true,
        url: 'github.com',
      }),
    ).toBe('github.com')
    expect(
      quickDialDefinition.summary?.({
        colour: '#ffffff',
        icon: null,
        label: 'My link',
        newTab: false,
        showIcon: true,
        url: 'github.com',
      }),
    ).toBe('My link')
    expect(
      quickDialDefinition.needs?.[0]?.met({
        colour: '#ffffff',
        icon: null,
        label: '',
        newTab: false,
        showIcon: true,
        url: 'javascript:alert(1)',
      }),
    ).toBe(false)
  })

  it('reads the nullable icon and string Site and Label options without falling back', () => {
    const options = {
      icon: null,
      label: 'Reading list',
      newTab: false,
      url: 'https://example.com/reading',
    }

    expect(readOptions(quickDialDefinition, options)).toEqual({
      ...options,
      colour: '#ffffff',
      showIcon: true,
    })
  })

  it('saves a Quick dial colour from the shared colour picker', () => {
    const onChange = vi.fn()
    render(
      <OptionsForm
        definition={quickDialDefinition}
        onChange={onChange}
        onPageValueChange={() => {}}
        options={{ icon: null, label: 'Example', newTab: false, url: 'example.com' }}
        page={PAGE}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Colour 5' }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ colour: '#1d3557' }))
  })

  it('gives two Quick dials different accessible names from their labels', () => {
    expect(
      accessibleName(quickDialDefinition, {
        colour: '#ffffff',
        icon: null,
        label: 'Work',
        newTab: false,
        showIcon: true,
        url: 'https://example.com',
      }),
    ).toBe('Quick dial, Work')
    expect(
      accessibleName(quickDialDefinition, {
        colour: '#ffffff',
        icon: null,
        label: 'Reading',
        newTab: false,
        showIcon: true,
        url: 'https://example.com',
      }),
    ).toBe('Quick dial, Reading')
  })

  it('draws the Choose a site Setup button for an unsafe stored URL', async () => {
    render(
      <WidgetBox
        definition={quickDialDefinition}
        id="quickd01"
        options={{
          colour: '#ffffff',
          icon: null,
          label: '',
          newTab: false,
          showIcon: true,
          url: 'javascript:alert(1)',
        }}
        page={PAGE}
        rect={RECT}
      />,
    )
    expect(await screen.findByRole('button', { name: 'Quick dial, Choose a site' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('link')).toBeNull())
  })
})
