import { describe, expect, it } from 'vitest'

import { WIDGETS } from '@/widgetSystem/registry'
import { hasSetup } from '@/widgetSystem/SetupButton'

// Every Widget is drawn in Storybook in each state it can be in, at each size it can be: this
// fails for a Widget added later (in phase 3) until it has its stories, as Chromatic's review is
// only as good as what is on it. Stories are for looking, so the test reads their names and
// titles and nothing else.

type StoryModule = Record<string, unknown> & { default: { title: string } }

const modules = Object.values(import.meta.glob<StoryModule>('./*/*.stories.tsx', { eager: true }))

/** The names of the stories under a title, from every module that has it. */
const storiesTitled = (title: string) =>
  modules
    .filter((module) => module.default.title === title)
    .flatMap((module) => Object.keys(module).filter((name) => name !== 'default'))

/** The titles under a prefix, such as every kind of setup a Widget has. */
const titlesStarting = (prefix: string) => [
  ...new Set(
    modules.map((module) => module.default.title).filter((title) => title.startsWith(prefix)),
  ),
]

const SIZES = ['Smallest', 'Starting', 'Largest']

describe('the Widget stories', () => {
  it('cover every Widget there is', () => {
    expect(WIDGETS.length).toBeGreaterThan(0)
    expect(modules.length).toBeGreaterThan(0)
  })

  describe.each(WIDGETS.map((definition) => [definition.name, definition] as const))(
    'the %s',
    (name, definition) => {
      it('is ready at its smallest, its starting and its largest size', () => {
        expect(storiesTitled(`${name}/Ready`)).toEqual(expect.arrayContaining(SIZES))
      })

      it('has one story with every size it may be, one under the other', () => {
        expect(storiesTitled(name)).toContain('AllSizes')
      })

      // A Widget with nothing to load and nothing to set up has no other state to draw.
      const sourced = definition.source !== undefined
      const setups = (definition.needs ?? []).filter(hasSetup)

      it.runIf(sourced)('is loading, and failed, at each size', () => {
        expect(storiesTitled(`${name}/Loading`)).toEqual(expect.arrayContaining(SIZES))
        expect(storiesTitled(`${name}/Failed`)).toEqual(expect.arrayContaining(SIZES))
      })

      it.runIf(setups.length > 0)('is set up, at each size, for each need the button meets', () => {
        const titles = titlesStarting(`${name}/Setup/`)
        // One for each need with words and an action; the Weather also has its options open.
        expect(titles.length).toBeGreaterThanOrEqual(setups.length)
        const sized = titles.filter((title) =>
          SIZES.every((size) => storiesTitled(title).includes(size)),
        )
        expect(sized.length).toBeGreaterThanOrEqual(setups.length)
      })
    },
  )

  it('has the Weather asked for each of its three needs, by name', () => {
    expect(titlesStarting('Weather/Setup/')).toEqual(
      expect.arrayContaining([
        'Weather/Setup/AllowLocation',
        'Weather/Setup/AllowSendingPlace',
        'Weather/Setup/ChoosePlace',
      ]),
    )
  })
})
