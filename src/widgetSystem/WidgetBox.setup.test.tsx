import { act, fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import { EXAMPLE_SIZES } from '@/test/fixtures'

import type { WidgetDefinition } from './definition'
import type { Need } from './needs'
import { WidgetBox } from './WidgetBox'

const RECT = { col: 5, h: 2, row: 4, w: 4 }
const PAGE = { hour12: false }

type Options = { allowed: boolean; named: boolean }

/** A Widget made up here: it draws "ready" once every need it is given is met. */
const example = (needs: readonly Need<Options>[]): WidgetDefinition<Options> => ({
  name: 'Example',
  needs,
  options: [
    { control: 'switch', default: false, id: 'allowed', label: 'Allowed' },
    { control: 'switch', default: false, id: 'named', label: 'Named' },
  ],
  sizes: EXAMPLE_SIZES,
  type: 'example',
  View: () => <p class="example">ready</p>,
})

/** Waits for what the promises in the handlers and the checks have to say. */
const settle = (act_: () => void = () => {}) =>
  act(async () => {
    act_()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

const draw = (definition: WidgetDefinition<Options>, options: unknown = {}, id?: string) =>
  render(
    <EditModeProvider>
      <WidgetBox definition={definition} id={id} options={options} page={PAGE} rect={RECT} />
    </EditModeProvider>,
  )

const setupButton = (label: string) => screen.getByRole('button', { name: label })

/** A need that asks the browser: met once `grant` is called. */
function asking() {
  let granted = false
  const run = vi.fn(() => {
    granted = true
    return Promise.resolve()
  })
  const need: Need<Options> = {
    action: { kind: 'ask', run },
    id: 'allowed',
    label: 'Allow access',
    met: () => granted,
  }
  return { need, run }
}

describe('the setup button', () => {
  describe('what it draws', () => {
    it("is one button in the box, in place of the View, with the Widget's name and the need's words", () => {
      const { need } = asking()
      const { container } = draw(example([need]))

      const box = container.querySelector('.widget-box')!
      expect(box.children).toHaveLength(1)
      const button = box.firstElementChild as HTMLElement
      expect(button.tagName).toBe('BUTTON')
      expect(button.classList.contains('widget-setup')).toBe(true)
      expect(button.querySelector('.widget-setup__name')?.textContent).toBe('Example')
      expect(button.querySelector('.widget-setup__label')?.textContent).toBe('Allow access')
      expect(container.querySelector('.example')).toBeNull()
    })

    it("is named for what it says: the Widget's name and then the need's words, which the box's group does not repeat", () => {
      const { need } = asking()
      draw(example([need]))

      // The group is "Example"; inside it the button is read as the words it shows.
      expect(screen.getByRole('group', { name: 'Example' })).toBeTruthy()
      // The comma between the two is in the name, not drawn.
      expect(setupButton('Example, Allow access').textContent).toBe('ExampleAllow access')
    })

    it('is a plain button: not a submit, and no popup unless it opens one', () => {
      const { need } = asking()
      draw(example([need]))

      expect(setupButton('Example, Allow access').getAttribute('type')).toBe('button')
      expect(setupButton('Example, Allow access').getAttribute('aria-haspopup')).toBeNull()
    })

    it('draws the first need that is unmet, not a later one', () => {
      const { need } = asking()
      const later: Need<Options> = {
        action: { kind: 'ask', run: vi.fn() },
        id: 'later',
        label: 'Later words',
        met: () => false,
      }
      draw(example([need, later]))

      expect(screen.getByText('Allow access')).toBeTruthy()
      expect(screen.queryByText('Later words')).toBeNull()
    })

    it('draws nothing for a need that has no words and no action: as before, the box is empty', () => {
      const { container } = draw(example([{ id: 'quiet', met: () => false }]))

      expect(container.querySelector('.widget-box')?.children).toHaveLength(0)
    })

    it('is in the same box whether or not the page is in edit mode', () => {
      const { need } = asking()
      function Edit() {
        const { enter } = useEditMode()
        return <button onClick={enter}>enter</button>
      }
      const { container } = render(
        <EditModeProvider>
          <Edit />
          <WidgetBox definition={example([need])} options={{}} page={PAGE} rect={RECT} />
        </EditModeProvider>,
      )
      expect(container.querySelectorAll('.widget-setup')).toHaveLength(1)

      fireEvent.click(screen.getByText('enter'))

      expect(container.querySelectorAll('.widget-setup')).toHaveLength(1)
      expect(setupButton('Example, Allow access')).toBeTruthy()
    })
  })

  describe('an ask need', () => {
    it('runs the action as the first thing the click does, before anything is awaited', () => {
      const { need, run } = asking()
      draw(example([need]))

      // Not inside `act` or `await`: Firefox only shows its prompt from the click's own call.
      fireEvent.click(setupButton('Example, Allow access'))

      expect(run).toHaveBeenCalledTimes(1)
    })

    it('draws the View once the action has met the need', async () => {
      const { need } = asking()
      const { container } = draw(example([need]))

      await settle(() => fireEvent.click(setupButton('Example, Allow access')))

      expect(container.querySelector('.example')?.textContent).toBe('ready')
      expect(container.querySelector('.widget-setup')).toBeNull()
    })

    it('keeps the button when the action leaves the need unmet, and lets it be pressed again', async () => {
      const run = vi.fn(() => Promise.resolve())
      const need: Need<Options> = {
        action: { kind: 'ask', run },
        id: 'allowed',
        label: 'Allow access',
        met: () => false,
      }
      draw(example([need]))

      await settle(() => fireEvent.click(setupButton('Example, Allow access')))
      await settle(() => fireEvent.click(setupButton('Example, Allow access')))

      expect(run).toHaveBeenCalledTimes(2)
    })

    it('keeps the button when the action is refused or throws', async () => {
      for (const run of [
        () => Promise.reject(new Error('denied')),
        () => {
          throw new Error('no')
        },
      ]) {
        const need: Need<Options> = {
          action: { kind: 'ask', run },
          id: 'allowed',
          label: 'Allow access',
          met: () => false,
        }
        const { unmount } = draw(example([need]))

        await settle(() => fireEvent.click(setupButton('Example, Allow access')))

        expect(setupButton('Example, Allow access')).toBeTruthy()
        unmount()
      }
    })

    it('does not ask again while the first ask is waiting', async () => {
      let answer!: () => void
      const run = vi.fn(() => new Promise<void>((resolve) => (answer = resolve)))
      const need: Need<Options> = {
        action: { kind: 'ask', run },
        id: 'allowed',
        label: 'Allow access',
        met: () => false,
      }
      draw(example([need]))

      fireEvent.click(setupButton('Example, Allow access'))
      fireEvent.click(setupButton('Example, Allow access'))
      await settle(answer)

      expect(run).toHaveBeenCalledTimes(1)
    })

    it('puts the next need’s button in its place when the first is met', async () => {
      const { need } = asking()
      const next: Need<Options> = {
        action: { kind: 'ask', run: vi.fn(() => Promise.resolve()) },
        id: 'next',
        label: 'Then this',
        met: () => false,
      }
      const { container } = draw(example([need, next]))

      await settle(() => fireEvent.click(setupButton('Example, Allow access')))

      expect(setupButton('Example, Then this')).toBeTruthy()
      expect(container.querySelectorAll('.widget-setup')).toHaveLength(1)
    })

    it('keeps the button while the needs are checked again, so it does not blink or lose focus', async () => {
      // The check answers late the second time: the first answer, "unmet", stands meanwhile.
      let granted = false
      const answers: ((met: boolean) => void)[] = []
      const run = vi.fn(() => {
        granted = true
        return Promise.resolve()
      })
      const need: Need<Options> = {
        action: { kind: 'ask', run },
        id: 'allowed',
        label: 'Allow access',
        met: () => (granted ? new Promise<boolean>((resolve) => answers.push(resolve)) : false),
      }
      const { container } = draw(example([need]))
      const button = setupButton('Example, Allow access')
      button.focus()

      await settle(() => fireEvent.click(button))

      expect(answers).toHaveLength(1)
      expect(container.querySelector('.widget-setup')).toBe(button)
      expect(document.activeElement).toBe(button)

      await settle(() => answers[0]!(true))
      expect(container.querySelector('.example')?.textContent).toBe('ready')
    })
  })

  describe('when the browser changes what it allows', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('asks the needs again when the tab comes back into view', async () => {
      const met = vi.fn(() => false)
      const { container } = draw(example([{ id: 'quiet', met }]))
      await settle()
      const asked = met.mock.calls.length

      await settle(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(met.mock.calls.length).toBeGreaterThan(asked)
      expect(container.querySelector('.widget-box')?.children).toHaveLength(0)
    })

    it('listens to nothing for a Widget that has no needs', async () => {
      const listen = vi.spyOn(document, 'addEventListener')
      const none: WidgetDefinition<Options> = { ...example([]), needs: undefined }

      draw(none)
      await settle()

      expect(listen).not.toHaveBeenCalledWith('visibilitychange', expect.anything())
    })

    it('draws the button again when a need that was met is not, at the next check', async () => {
      let allowed = true
      const need: Need<Options> = {
        action: { kind: 'ask', run: vi.fn() },
        id: 'allowed',
        label: 'Allow access',
        met: () => allowed,
      }
      const { container } = draw(example([need]))
      expect(container.querySelector('.example')).not.toBeNull()

      allowed = false
      await settle(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(container.querySelector('.example')).toBeNull()
      expect(setupButton('Example, Allow access')).toBeTruthy()
    })
  })

  describe('when the last button goes', () => {
    const box = () => document.querySelector<HTMLElement>('.widget-box')!

    it('gives focus to the box when it was on the button, so the keyboard is not dropped on the page', async () => {
      const { need } = asking()
      draw(example([need]))
      const button = setupButton('Example, Allow access')
      button.focus()

      await settle(() => fireEvent.click(button))

      expect(document.querySelector('.example')).not.toBeNull()
      expect(document.activeElement).toBe(box())
    })

    it('makes the box focusable only for that, and takes it back when focus moves on', async () => {
      const { need } = asking()
      draw(example([need]))
      expect(box().hasAttribute('tabindex')).toBe(false)
      const button = setupButton('Example, Allow access')
      button.focus()

      await settle(() => fireEvent.click(button))
      expect(box().getAttribute('tabindex')).toBe('-1')
      box().blur()

      expect(box().hasAttribute('tabindex')).toBe(false)
    })

    it('does the same when a state panel, and not the View, takes its place', async () => {
      const { need } = asking()
      const definition: WidgetDefinition<Options> = {
        ...example([need]),
        source: {
          source: {
            cache: { get: () => Promise.resolve(undefined), keys: () => Promise.resolve([]) },
          } as never,
          useQuery: () => ({ context: undefined, query: null }),
        },
      } as never
      draw(definition)
      const button = setupButton('Example, Allow access')
      button.focus()

      await settle(() => fireEvent.click(button))

      expect(document.querySelector('.example')).toBeNull()
      expect(document.activeElement).toBe(box())
    })

    it('leaves focus where it is when it was not on the button', async () => {
      const { need } = asking()
      render(
        <>
          <input aria-label="Elsewhere" />
          <EditModeProvider>
            <WidgetBox definition={example([need])} options={{}} page={PAGE} rect={RECT} />
          </EditModeProvider>
        </>,
      )
      const elsewhere = screen.getByLabelText('Elsewhere')
      elsewhere.focus()

      await settle(() => fireEvent.click(setupButton('Example, Allow access')))

      expect(document.activeElement).toBe(elsewhere)
      expect(box().hasAttribute('tabindex')).toBe(false)
    })

    it('does not touch the box’s own tab stop in edit mode', async () => {
      const { need } = asking()
      function Edit() {
        const { enter } = useEditMode()
        return <button onClick={enter}>enter</button>
      }
      render(
        <EditModeProvider>
          <Edit />
          <WidgetBox definition={example([need])} options={{}} page={PAGE} rect={RECT} />
        </EditModeProvider>,
      )
      fireEvent.click(screen.getByText('enter'))
      const button = setupButton('Example, Allow access')
      button.focus()

      await settle(() => fireEvent.click(button))

      expect(document.activeElement).toBe(box())
      expect(box().getAttribute('tabindex')).toBe('0')
      box().blur()
      expect(box().getAttribute('tabindex')).toBe('0')
    })
  })

  describe('an action that fails', () => {
    it('can be pressed again after one that rejects, and asks nothing again for it', async () => {
      const run = vi
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error('no')))
        .mockImplementation(() => Promise.resolve())
      const need: Need<Options> = {
        action: { kind: 'ask', run },
        id: 'allowed',
        label: 'Allow access',
        met: () => false,
      }
      draw(example([need]))

      await settle(() => fireEvent.click(setupButton('Example, Allow access')))
      await settle(() => fireEvent.click(setupButton('Example, Allow access')))

      expect(run).toHaveBeenCalledTimes(2)
    })

    it('can be pressed again after one that throws', async () => {
      const run = vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('no')
        })
        .mockImplementation(() => Promise.resolve())
      const need: Need<Options> = {
        action: { kind: 'ask', run },
        id: 'allowed',
        label: 'Allow access',
        met: () => false,
      }
      draw(example([need]))

      await settle(() => fireEvent.click(setupButton('Example, Allow access')))
      await settle(() => fireEvent.click(setupButton('Example, Allow access')))

      expect(run).toHaveBeenCalledTimes(2)
    })

    it('does not check the needs again for an action that failed', async () => {
      const met = vi.fn(() => false)
      const need: Need<Options> = {
        action: { kind: 'ask', run: () => Promise.reject(new Error('no')) },
        id: 'allowed',
        label: 'Allow access',
        met,
      }
      draw(example([need]))
      const asked = met.mock.calls.length

      await settle(() => fireEvent.click(setupButton('Example, Allow access')))

      expect(met).toHaveBeenCalledTimes(asked)
    })
  })

  describe('an option need', () => {
    it('is drawn, and not pressable, where there is no popover to open (a Widget drawn alone)', () => {
      const need: Need<Options> = {
        action: { kind: 'option', option: 'named' },
        id: 'named',
        label: 'Name it',
        met: (options) => options.named,
      }
      draw(example([need]), {}, 'example1')

      expect((setupButton('Example, Name it') as HTMLButtonElement).disabled).toBe(true)
    })

    it('goes when the option is set, and the View takes its place', () => {
      const need: Need<Options> = {
        action: { kind: 'option', option: 'named' },
        id: 'named',
        label: 'Name it',
        met: (options) => options.named,
      }
      const definition = example([need])
      const view = render(
        <WidgetBox definition={definition} options={{}} page={PAGE} rect={RECT} />,
      )
      expect(view.container.querySelector('.widget-setup')).not.toBeNull()

      view.rerender(
        <WidgetBox definition={definition} options={{ named: true }} page={PAGE} rect={RECT} />,
      )

      expect(view.container.querySelector('.widget-setup')).toBeNull()
      expect(view.container.querySelector('.example')).not.toBeNull()
    })
  })

  describe('focus', () => {
    it('leaves the box with no tabindex outside edit mode: not a tab stop, and not focused by a click', () => {
      const { need } = asking()
      const { container } = draw(example([need]))

      expect(container.querySelector('.widget-box')?.hasAttribute('tabindex')).toBe(false)
    })

    it('makes the box a tab stop in edit mode, as before', () => {
      const { need } = asking()
      function Enter() {
        return <button onClick={useEditMode().enter}>enter</button>
      }
      const { container } = render(
        <EditModeProvider>
          <Enter />
          <WidgetBox definition={example([need])} options={{}} page={PAGE} rect={RECT} />
        </EditModeProvider>,
      )

      fireEvent.click(screen.getByText('enter'))

      expect(container.querySelector('.widget-box')?.getAttribute('tabindex')).toBe('0')
    })
  })
})
