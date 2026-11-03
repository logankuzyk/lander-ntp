import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { EditModeProvider, useEditMode } from './useEditMode'

/** Shows what the context says, with a button for each thing it can do. */
function Probe() {
  const { canChange, editing, enter, leave } = useEditMode()
  return (
    <div>
      <p data-testid="state">{`${editing ? 'editing' : 'browsing'} ${canChange ? 'can' : 'cannot'}`}</p>
      <button onClick={enter} type="button">
        enter
      </button>
      <button onClick={leave} type="button">
        leave
      </button>
    </div>
  )
}

const state = () => screen.getByTestId('state').textContent

describe('useEditMode', () => {
  it('starts out browsing', () => {
    render(
      <EditModeProvider>
        <Probe />
      </EditModeProvider>,
    )

    expect(state()).toBe('browsing can')
  })

  it('enters and leaves, and either one twice changes nothing more', () => {
    render(
      <EditModeProvider>
        <Probe />
      </EditModeProvider>,
    )

    fireEvent.click(screen.getByText('enter'))
    fireEvent.click(screen.getByText('enter'))
    expect(state()).toBe('editing can')

    fireEvent.click(screen.getByText('leave'))
    fireEvent.click(screen.getByText('leave'))
    expect(state()).toBe('browsing can')
  })

  it('says whether the Layout can be changed, as it is told', () => {
    const { rerender } = render(
      <EditModeProvider canChange={false}>
        <Probe />
      </EditModeProvider>,
    )
    expect(state()).toBe('browsing cannot')

    rerender(
      <EditModeProvider canChange>
        <Probe />
      </EditModeProvider>,
    )
    expect(state()).toBe('browsing can')
  })

  it('keeps editing when the Layout becomes read-only: it is page state, not the Layout', () => {
    const { rerender } = render(
      <EditModeProvider>
        <Probe />
      </EditModeProvider>,
    )
    fireEvent.click(screen.getByText('enter'))

    rerender(
      <EditModeProvider canChange={false}>
        <Probe />
      </EditModeProvider>,
    )

    expect(state()).toBe('editing cannot')
  })

  it('is not editing for what is drawn outside a provider, such as a Widget on its own', () => {
    render(<Probe />)

    expect(state()).toBe('browsing can')
    fireEvent.click(screen.getByText('enter'))
    expect(state()).toBe('browsing can')
  })
})
