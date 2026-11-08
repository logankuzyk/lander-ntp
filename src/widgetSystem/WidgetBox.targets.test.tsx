import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import { checkLayout } from '@/layout/check'
import { clockDefinition } from '@/widgets/Clock/definition'

import { OptionsPopoverProvider } from './useOptionsPopover'
import { WidgetBox } from './WidgetBox'

const RECT = { col: 5, h: 2, row: 4, w: 4 }

describe('WidgetBox, for a callout', () => {
  it('names its box for the Widget’s type, to point at', () => {
    const { container } = render(
      <WidgetBox definition={clockDefinition} options={{}} page={{ hour12: false }} rect={RECT} />,
    )

    expect(container.querySelector('.widget-box')?.getAttribute('data-callout-target')).toBe(
      'widget:clock',
    )
  })

  it('names its Options button, which only edit mode draws', () => {
    const Edit = () => <button onClick={useEditMode().enter}>edit</button>
    const { container } = render(
      <EditModeProvider>
        <Edit />
        <OptionsPopoverProvider
          commit={vi.fn()}
          layout={checkLayout({ v: 1, widgets: [] })}
          loaded
          onOpen={vi.fn()}
          onPageValueChange={vi.fn()}
          otherOpen={false}
          page={{ hour12: false }}
        >
          <WidgetBox
            definition={clockDefinition}
            id="clock0aa"
            options={{}}
            page={{ hour12: false }}
            rect={RECT}
          />
        </OptionsPopoverProvider>
      </EditModeProvider>,
    )
    expect(container.querySelector('.widget-box__options')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'edit' }))

    expect(
      container.querySelector('.widget-box__options')?.getAttribute('data-callout-target'),
    ).toBe('options')
  })
})
