import type { Meta, StoryObj } from '@storybook/preact-vite'
import type { ComponentChildren, JSX } from 'preact'
import { useEffect } from 'preact/hooks'

import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import { COLS, ROWS } from '@/layout/geometry'
import { clockDefinition } from '@/widgets/Clock/definition'
import { defaultOptions } from '@/widgetSystem/options'

import { withPage } from '../../.storybook/withPage'
import { RemovalProvider } from './useRemoval'
import { WidgetBox } from './WidgetBox'

// One Widget's box as edit mode draws it, with nothing around it: here the Clock in the middle,
// with the button that removes it at its top right. Pressing it does nothing in a story; the
// page's own is in Grid/EditingWithUndo. No storage, no request.
const meta = { decorators: [withPage], title: 'Widget' } satisfies Meta
export default meta

type Story = StoryObj<typeof meta>

/** Edit mode is page state: the story enters it as the Edit button would. */
function Editing({ children }: { children: ComponentChildren }) {
  const { enter } = useEditMode()
  useEffect(enter, [enter])
  return <>{children}</>
}

/** A Widget in edit mode with its remove button; the frame is a tab stop, so Tab reaches both. */
export const WithRemove: Story = {
  render: () => (
    <EditModeProvider>
      <Editing>
        <RemovalProvider value={{ available: true, remove: () => {} }}>
          <div
            class="grid grid--editing"
            style={{ '--cols': String(COLS), '--rows': String(ROWS) } as JSX.CSSProperties}
          >
            <WidgetBox
              definition={clockDefinition}
              id="clock0aa"
              options={defaultOptions(clockDefinition)}
              page={{ hour12: false }}
              rect={{ col: 5, h: 2, row: 4, w: 4 }}
            />
          </div>
        </RemovalProvider>
      </Editing>
    </EditModeProvider>
  ),
}
