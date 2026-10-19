import { act, render } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { CHECKING, checkNeeds, type Need, useUnmetNeed } from './needs'

type Options = { place: string | null }

/** A promise settled by hand, to answer a need late. */
function later<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, reject, resolve }
}

/** Gives an answer, then lets every promise it set going finish, inside `act`. */
const answer = (give: () => void) =>
  act(async () => {
    give()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

const need = (id: string, met: Need<Options>['met']): Need<Options> => ({ id, met })

/** Needs answered by hand: each check of the need makes a new answer to settle. */
function lateNeed(id: string) {
  const answers: ReturnType<typeof later<boolean>>[] = []
  const met = (): Promise<boolean> => {
    const answer = later<boolean>()
    answers.push(answer)
    return answer.promise
  }
  return { answers, need: need(id, met) }
}

/** Draws what `useUnmetNeed` gave, and keeps every value it gave, one per render. */
function setup(needs: readonly Need<Options>[] | undefined, initial: Options) {
  const seen: string[] = []
  function Probe({ options }: { options: Options }) {
    const result = useUnmetNeed(needs, options)
    const text = result === CHECKING ? CHECKING : result === null ? 'none' : result.id
    seen.push(text)
    return <output>{text}</output>
  }
  const view = render(<Probe options={initial} />)
  return {
    seen,
    shown: () => view.container.textContent,
    update: (options: Options) => view.rerender(<Probe options={options} />),
  }
}

describe('useUnmetNeed', () => {
  it('gives none for a Widget with no needs, in the first render', () => {
    const { seen, shown } = setup(undefined, { place: null })
    expect(seen).toEqual(['none'])
    expect(shown()).toBe('none')
  })

  it('settles answers given at once in the render that asked: never "checking"', () => {
    const { seen } = setup([need('a', () => true), need('b', () => true)], { place: 'Victoria' })
    expect(seen).toEqual(['none'])
  })

  it('gives the first unmet need, in the first render, when the answers come at once', () => {
    const { seen } = setup(
      [need('a', () => true), need('b', () => false), need('c', () => false)],
      {
        place: null,
      },
    )
    expect(seen).toEqual(['b'])
  })

  it('asks the needs in order and stops at the first unmet one', () => {
    const asked: string[] = []
    const ask = (id: string, answer: boolean) =>
      need(id, () => {
        asked.push(id)
        return answer
      })
    setup([ask('a', true), ask('b', false), ask('c', true)], { place: null })
    expect(asked).toEqual(['a', 'b'])
  })

  it('passes the options to each need', () => {
    const met = vi.fn(() => true)
    setup([need('a', met)], { place: 'Victoria' })
    expect(met).toHaveBeenCalledWith({ place: 'Victoria' })
  })

  it('gives "checking" until a late answer arrives, then none when it is met', async () => {
    const a = lateNeed('a')
    const { seen, shown } = setup([a.need], { place: null })
    expect(shown()).toBe(CHECKING)

    await answer(() => a.answers[0]!.resolve(true))

    expect(shown()).toBe('none')
    expect(seen).toEqual([CHECKING, 'none'])
  })

  it('gives the need once a late answer says it is unmet', async () => {
    const a = lateNeed('a')
    const { shown } = setup([a.need], { place: null })

    await answer(() => a.answers[0]!.resolve(false))

    expect(shown()).toBe('a')
  })

  it('asks a need after a late one only once the late one is met', async () => {
    const a = lateNeed('a')
    const second = vi.fn(() => true)
    const { shown } = setup([a.need, need('b', second)], { place: null })
    expect(second).not.toHaveBeenCalled()

    await answer(() => a.answers[0]!.resolve(true))

    expect(second).toHaveBeenCalledTimes(1)
    expect(shown()).toBe('none')
  })

  it('does not ask the needs after a late one that turns out unmet', async () => {
    const a = lateNeed('a')
    const second = vi.fn(() => true)
    const { shown } = setup([a.need, need('b', second)], { place: null })

    await answer(() => a.answers[0]!.resolve(false))

    expect(second).not.toHaveBeenCalled()
    expect(shown()).toBe('a')
  })

  it('gives "checking" for a late need that comes after answers given at once', () => {
    const b = lateNeed('b')
    const { seen } = setup([need('a', () => true), b.need], { place: null })
    expect(seen).toEqual([CHECKING])
  })

  it('counts a need that throws as unmet', () => {
    const { shown } = setup(
      [
        need('a', () => {
          throw new Error('no')
        }),
      ],
      { place: null },
    )
    expect(shown()).toBe('a')
  })

  it('counts a need whose late answer fails as unmet', async () => {
    const a = lateNeed('a')
    const { shown } = setup([a.need], { place: null })

    await answer(() => a.answers[0]!.reject(new Error('no')))

    expect(shown()).toBe('a')
  })

  it('checks again when the options change, and not when they are the same', () => {
    const met = vi.fn((options: Options) => options.place !== null)
    const { seen, shown, update } = setup([need('place', met)], { place: null })
    expect(shown()).toBe('place')

    update({ place: null })
    expect(met).toHaveBeenCalledTimes(1)

    update({ place: 'Victoria' })
    expect(met).toHaveBeenCalledTimes(2)
    expect(shown()).toBe('none')
    // Each answer given at once is in the render that asked, so there was never a "checking".
    expect(seen).not.toContain(CHECKING)
  })

  it('checks a late need again when the options change, showing "checking" until it answers', async () => {
    const a = lateNeed('a')
    const { shown, update } = setup([a.need], { place: null })
    await answer(() => a.answers[0]!.resolve(false))
    expect(shown()).toBe('a')

    update({ place: 'Victoria' })
    expect(shown()).toBe(CHECKING)

    await answer(() => a.answers[1]!.resolve(true))
    expect(shown()).toBe('none')
  })

  it('ignores a late answer for options that have since changed', async () => {
    const a = lateNeed('a')
    const { shown, update } = setup([a.need], { place: null })

    update({ place: 'Victoria' })
    // The answer for the old options arrives after the options changed: it says "met", but
    // for the old options.
    await answer(() => a.answers[0]!.resolve(true))
    expect(shown()).toBe(CHECKING)

    await answer(() => a.answers[1]!.resolve(false))
    expect(shown()).toBe('a')
  })

  it('does not let a late answer for old options overwrite the answer for the new ones', async () => {
    const a = lateNeed('a')
    const { shown, update } = setup([a.need], { place: null })

    update({ place: 'Victoria' })
    await answer(() => a.answers[1]!.resolve(true))
    expect(shown()).toBe('none')

    await answer(() => a.answers[0]!.resolve(false))
    expect(shown()).toBe('none')
  })

  it('ignores a late need that was still being asked for options that have since changed', async () => {
    const a = lateNeed('a')
    const second = vi.fn((options: Options) => options.place === 'Victoria')
    const { shown, update } = setup([a.need, need('b', second)], { place: null })

    update({ place: 'Victoria' })
    // The old check stops there: it does not go on to ask b about options no longer current.
    await answer(() => a.answers[0]!.resolve(true))
    expect(second).not.toHaveBeenCalled()
    expect(shown()).toBe(CHECKING)

    await answer(() => a.answers[1]!.resolve(true))
    expect(shown()).toBe('none')
  })

  it('counts an answer that is not true as unmet, whatever it is', () => {
    for (const answer of [undefined, null, 'yes', 1, {}]) {
      const { shown } = setup([need('a', () => answer as unknown as boolean)], { place: null })
      expect(shown()).toBe('a')
    }
  })

  it('takes a thenable that is not a Promise as a late answer', async () => {
    const thenable = { then: (resolve: (met: boolean) => void) => resolve(true) }
    const { shown } = setup([need('a', () => thenable as unknown as Promise<boolean>)], {
      place: null,
    })
    expect(shown()).toBe(CHECKING)

    await answer(() => {})

    expect(shown()).toBe('none')
  })

  it('counts a thenable that throws as unmet', async () => {
    const thenable = {
      then: () => {
        throw new Error('no')
      },
    }
    const { shown } = setup([need('a', () => thenable as unknown as Promise<boolean>)], {
      place: null,
    })

    await answer(() => {})

    expect(shown()).toBe('a')
  })

  it('counts a late answer that is not true as unmet', async () => {
    const a = lateNeed('a')
    const { shown } = setup([a.need], { place: null })

    await answer(() => a.answers[0]!.resolve('yes' as unknown as boolean))

    expect(shown()).toBe('a')
  })

  describe('a cancelled check', () => {
    it('never gives an answer, so it cannot report that every need is met', async () => {
      const a = lateNeed('a')
      const later = checkNeeds([a.need], { place: null })
      let settled = false
      void later.later!.then(() => (settled = true))

      later.cancel()
      a.answers[0]!.resolve(true)
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(settled).toBe(false)
    })

    it('asks no more needs', async () => {
      const a = lateNeed('a')
      const second = vi.fn(() => true)
      const check = checkNeeds([a.need, need('b', second)], { place: null })

      check.cancel()
      a.answers[0]!.resolve(true)
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(second).not.toHaveBeenCalled()
    })
  })

  describe('when the options are compared', () => {
    type Loose = { [key: string]: unknown }

    /** Draws with `first`, then with `second`; how many times were the needs asked? */
    function asked(first: Loose, second: Loose) {
      const met = vi.fn(() => true)
      const needs = [{ id: 'a', met }]
      function Probe({ options }: { options: Loose }) {
        useUnmetNeed(needs, options)
        return null
      }
      const view = render(<Probe options={first} />)
      view.rerender(<Probe options={second} />)
      return met.mock.calls.length
    }

    it('checks again when something nested in the options changes', () => {
      expect(asked({ place: { name: 'Victoria' } }, { place: { name: 'Oslo' } })).toBe(2)
    })

    it('checks again when an element of an array in the options changes', () => {
      expect(asked({ fields: ['a', 'b'] }, { fields: ['a', 'c'] })).toBe(2)
      expect(asked({ fields: ['a'] }, { fields: ['a', 'b'] })).toBe(2)
    })

    it('does not check again for equal data in new objects and arrays', () => {
      expect(asked({ fields: ['a', { on: true }] }, { fields: ['a', { on: true }] })).toBe(1)
    })

    it('does not check again when the same keys come in another order', () => {
      // Built from entries: the lint rule that sorts object keys would put a literal back in order.
      const reordered = Object.fromEntries([
        ['b', 2],
        ['a', 1],
      ])
      expect(Object.keys(reordered)).toEqual(['b', 'a'])
      expect(asked({ a: 1, b: 2 }, reordered)).toBe(1)
    })

    it('tells an empty array from an empty object', () => {
      expect(asked({ x: [] }, { x: {} })).toBe(2)
      expect(asked({ x: {} }, { x: [] })).toBe(2)
    })

    it('tells a key set to undefined from a key that is missing', () => {
      expect(asked({ a: undefined }, { b: undefined })).toBe(2)
    })
  })

  describe('with needs that are not stable', () => {
    // The contract is that `needs` is one array, such as the one on a definition. A new array
    // on each render is a new check on each render: the needs are asked again every time.
    it('asks answered-at-once needs again on every render', () => {
      const met = vi.fn(() => true)
      function Probe(_props: { tick: number }) {
        useUnmetNeed([{ id: 'a', met }], { tick: 0 })
        return null
      }
      const view = render(<Probe tick={0} />)
      view.rerender(<Probe tick={1} />)
      view.rerender(<Probe tick={2} />)
      expect(met).toHaveBeenCalledTimes(3)
    })

    it('never leaves "checking" for a late need: each answer renders again, which starts over', async () => {
      const a = lateNeed('a')
      function Probe() {
        const result = useUnmetNeed([a.need], { place: null })
        return <output>{result === CHECKING ? CHECKING : 'settled'}</output>
      }
      const view = render(<Probe />)
      expect(a.answers).toHaveLength(1)

      await answer(() => a.answers[0]!.resolve(true))

      // The answer was for the first array; the render it caused asked again with a new one.
      expect(a.answers).toHaveLength(2)
      expect(view.container.textContent).toBe(CHECKING)
    })
  })
})
