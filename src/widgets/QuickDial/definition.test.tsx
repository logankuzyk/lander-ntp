import { render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { accessibleName } from '@/widgetSystem/name'
import { readOptions } from '@/widgetSystem/options'
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
      quickDialDefinition.sizes.starting({ icon: null, label: '', newTab: false, url: '' }),
    ).toEqual({ h: 1, w: 1 })
  })

  it('uses the label or host as its summary and treats an unsafe stored URL as unset', () => {
    expect(
      quickDialDefinition.summary?.({ icon: null, label: '', newTab: false, url: 'github.com' }),
    ).toBe('github.com')
    expect(
      quickDialDefinition.summary?.({
        icon: null,
        label: 'My link',
        newTab: false,
        url: 'github.com',
      }),
    ).toBe('My link')
    expect(
      quickDialDefinition.needs?.[0]?.met({
        icon: null,
        label: '',
        newTab: false,
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

    expect(readOptions(quickDialDefinition, options)).toEqual(options)
  })

  it('gives two Quick dials different accessible names from their labels', () => {
    expect(
      accessibleName(quickDialDefinition, {
        icon: null,
        label: 'Work',
        newTab: false,
        url: 'https://example.com',
      }),
    ).toBe('Quick dial, Work')
    expect(
      accessibleName(quickDialDefinition, {
        icon: null,
        label: 'Reading',
        newTab: false,
        url: 'https://example.com',
      }),
    ).toBe('Quick dial, Reading')
  })

  it('draws the Choose a site Setup button for an unsafe stored URL', async () => {
    render(
      <WidgetBox
        definition={quickDialDefinition}
        id="quickd01"
        options={{ icon: null, label: '', newTab: false, url: 'javascript:alert(1)' }}
        page={PAGE}
        rect={RECT}
      />,
    )
    expect(await screen.findByRole('button', { name: 'Quick dial, Choose a site' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('link')).toBeNull())
  })
})
