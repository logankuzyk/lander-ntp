import { describe, expect, it } from 'vitest'

import { seededRandom } from '@/test/fixtures'

import {
  choosePhoto,
  FREQUENCIES,
  msUntilAdvance,
  nextPhoto,
  photoForSettings,
  photoForVisit,
  shouldAdvance,
  type Frequency,
  type PhotoSettings,
  type PhotoState,
} from './rotation'

const T0 = Date.parse('2026-09-11T10:00:00Z')
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

const state = (overrides: Partial<PhotoState> = {}): PhotoState => ({
  currentId: 'a',
  shownAt: T0,
  bag: ['b', 'c'],
  ...overrides,
})

const INTERVALS: [Frequency, number][] = [
  ['30s', 30 * SECOND],
  ['1m', MINUTE],
  ['5m', 5 * MINUTE],
  ['15m', 15 * MINUTE],
  ['1h', HOUR],
  ['6h', 6 * HOUR],
  ['12h', 12 * HOUR],
]

describe('shouldAdvance', () => {
  it.each(FREQUENCIES)('%s advances when nothing has been shown yet', (frequency) => {
    expect(shouldAdvance(frequency, null, T0)).toBe(true)
    expect(shouldAdvance(frequency, state({ currentId: null }), T0)).toBe(true)
  })

  it('off never advances', () => {
    expect(shouldAdvance('off', state(), T0 + 365 * 24 * HOUR)).toBe(false)
  })

  it('every-visit always advances', () => {
    expect(shouldAdvance('every-visit', state(), T0)).toBe(true)
  })

  it.each(INTERVALS)('%s advances exactly at its boundary', (frequency, interval) => {
    expect(shouldAdvance(frequency, state(), T0 + interval - 1)).toBe(false)
    expect(shouldAdvance(frequency, state(), T0 + interval)).toBe(true)
    expect(shouldAdvance(frequency, state(), T0 + interval + 1)).toBe(true)
  })

  it('daily advances at the next local midnight', () => {
    const lateNight = state({ shownAt: new Date(2026, 8, 11, 23, 59, 59).getTime() })
    expect(
      shouldAdvance('daily', lateNight, new Date(2026, 8, 11, 23, 59, 59, 999).getTime()),
    ).toBe(false)
    expect(shouldAdvance('daily', lateNight, new Date(2026, 8, 12, 0, 0, 0).getTime())).toBe(true)

    const earlyMorning = state({ shownAt: new Date(2026, 8, 11, 0, 0, 0).getTime() })
    expect(shouldAdvance('daily', earlyMorning, new Date(2026, 8, 11, 23, 59, 59).getTime())).toBe(
      false,
    )
  })
})

describe('msUntilAdvance', () => {
  it('has no timer for off and every-visit', () => {
    expect(msUntilAdvance('off', state(), T0)).toBeNull()
    expect(msUntilAdvance('every-visit', state(), T0)).toBeNull()
  })

  it('returns the time left, clamped at zero', () => {
    expect(msUntilAdvance('30s', state(), T0 + 10 * SECOND)).toBe(20 * SECOND)
    expect(msUntilAdvance('30s', state(), T0 + HOUR)).toBe(0)
  })

  it('counts down to local midnight for daily', () => {
    const shownAt = new Date(2026, 8, 11, 22, 0, 0).getTime()
    expect(msUntilAdvance('daily', state({ shownAt }), shownAt)).toBe(2 * HOUR)
  })
})

describe('nextPhoto', () => {
  const ids = ['a', 'b', 'c', 'd', 'e']

  it('shows every photo once before any repeats', () => {
    const random = seededRandom(42)
    let current: PhotoState | null = null
    const shown: string[] = []
    for (let i = 0; i < ids.length * 4; i++) {
      current = nextPhoto(current, ids, T0 + i, random)
      shown.push(current.currentId as string)
    }

    for (let cycle = 0; cycle < 4; cycle++) {
      const block = shown.slice(cycle * ids.length, (cycle + 1) * ids.length)
      expect([...block].sort()).toEqual(ids)
    }
    // No immediate repeats, including across bag boundaries.
    shown.slice(1).forEach((id, i) => expect(id).not.toBe(shown[i]))
  })

  it('takes the head of the bag and records when it was shown', () => {
    expect(nextPhoto(state(), ids, T0 + 5)).toEqual({ currentId: 'b', shownAt: T0 + 5, bag: ['c'] })
  })

  it('refills the bag as soon as it empties so the upcoming photo is known', () => {
    const next = nextPhoto(state({ bag: ['b'] }), ids, T0, seededRandom(1))
    expect(next.currentId).toBe('b')
    expect([...next.bag].sort()).toEqual(ids)
    expect(next.bag[0]).not.toBe('b')
  })

  it('skips ids that are no longer in the manifest', () => {
    const next = nextPhoto(state({ bag: ['gone', 'c', 'also-gone'] }), ids, T0)
    expect(next).toMatchObject({ currentId: 'c' })
    expect(next.bag).not.toContain('gone')
  })

  it('refills when every queued id has left the manifest', () => {
    const next = nextPhoto(state({ currentId: 'x', bag: ['y', 'z'] }), ids, T0, seededRandom(7))
    expect(ids).toContain(next.currentId)
  })

  it('works with a single photo', () => {
    const next = nextPhoto(null, ['only'], T0)
    expect(next).toEqual({ currentId: 'only', shownAt: T0, bag: ['only'] })
    expect(nextPhoto(next, ['only'], T0 + 1).currentId).toBe('only')
  })

  it('shows nothing when the manifest is empty', () => {
    expect(nextPhoto(state(), [], T0)).toEqual({ currentId: null, shownAt: T0, bag: [] })
  })
})

describe('choosePhoto', () => {
  const ids = ['a', 'b', 'c', 'd']

  it('shows the photo now and takes it out of the bag', () => {
    expect(choosePhoto(state({ bag: ['b', 'c', 'd'] }), 'c', ids, T0 + 5)).toEqual({
      currentId: 'c',
      shownAt: T0 + 5,
      bag: ['b', 'd'],
    })
  })

  it('refills the bag when the chosen photo was the last one in it', () => {
    const chosen = choosePhoto(state({ bag: ['b'] }), 'b', ids, T0, seededRandom(3))
    expect(chosen?.currentId).toBe('b')
    expect([...(chosen?.bag ?? [])].sort()).toEqual(ids)
    expect(chosen?.bag[0]).not.toBe('b')
  })

  it('works before any photo has been shown', () => {
    const chosen = choosePhoto(null, 'd', ids, T0, seededRandom(5))
    expect(chosen?.currentId).toBe('d')
    expect(chosen?.bag[0]).not.toBe('d')
  })

  it('drops ids that have left the manifest', () => {
    expect(choosePhoto(state({ bag: ['gone', 'c'] }), 'b', ids, T0)?.bag).toEqual(['c'])
  })

  it('ignores a photo that is not in the manifest', () => {
    const current = state()
    expect(choosePhoto(current, 'gone', ids, T0)).toBe(current)
    expect(choosePhoto(null, 'gone', ids, T0)).toBeNull()
  })
})

describe('photoForVisit', () => {
  const ids = ['a', 'b', 'c']

  it('picks a photo on the first visit', () => {
    expect(photoForVisit('off', null, ids, T0).currentId).not.toBeNull()
  })

  it('keeps the pinned photo when off', () => {
    const pinned = state()
    expect(photoForVisit('off', pinned, ids, T0 + 24 * HOUR)).toBe(pinned)
  })

  it('moves on every visit', () => {
    expect(photoForVisit('every-visit', state(), ids, T0)).toMatchObject({ currentId: 'b' })
  })

  it('keeps the photo until an interval has passed', () => {
    const current = state()
    expect(photoForVisit('1h', current, ids, T0 + HOUR - 1)).toBe(current)
    expect(photoForVisit('1h', current, ids, T0 + HOUR)).toMatchObject({
      currentId: 'b',
      shownAt: T0 + HOUR,
    })
  })

  it('moves on when the current photo left the manifest, even when off', () => {
    expect(photoForVisit('off', state({ currentId: 'gone' }), ids, T0)).toMatchObject({
      currentId: 'b',
    })
  })
})

describe('photoForSettings', () => {
  const ids = { all: ['a', 'b', 'c', 'd'], pool: ['c', 'd'] }
  const cycling = (frequency: Frequency = '1h'): PhotoSettings => ({
    mode: 'cycle',
    frequency,
    tags: ['water'],
    pinnedId: null,
  })
  const pinned = (pinnedId: string | null): PhotoSettings => ({
    mode: 'pinned',
    frequency: '1h',
    tags: ['water'],
    pinnedId,
  })

  it('shows the pinned photo, even outside the pool', () => {
    expect(photoForSettings(pinned('a'), state({ currentId: 'c' }), ids, T0, true)).toMatchObject({
      currentId: 'a',
      shownAt: T0,
    })
  })

  it('keeps the state when the pinned photo is already showing', () => {
    const current = state({ currentId: 'b' })
    expect(photoForSettings(pinned('b'), current, ids, T0 + 24 * HOUR, true)).toBe(current)
  })

  it('keeps the photo on screen when pinned without one, or to one that has left', () => {
    const current = state({ currentId: 'b' })
    expect(photoForSettings(pinned(null), current, ids, T0 + 24 * HOUR, true)).toBe(current)
    expect(photoForSettings(pinned('gone'), current, ids, T0, false)).toBe(current)
  })

  it('follows the frequency on a visit, drawing from the pool', () => {
    const current = state({ currentId: 'c', bag: ['a', 'd'] })
    expect(photoForSettings(cycling('1h'), current, ids, T0 + HOUR - 1, true)).toBe(current)
    expect(photoForSettings(cycling('1h'), current, ids, T0 + HOUR, true)).toMatchObject({
      currentId: 'd',
    })
  })

  it('keeps a photo from the pool when the settings change', () => {
    const current = state({ currentId: 'd' })
    expect(photoForSettings(cycling('every-visit'), current, ids, T0, false)).toBe(current)
  })

  it('moves on when the pool no longer has the photo', () => {
    const next = photoForSettings(cycling(), state({ currentId: 'a' }), ids, T0, false)
    expect(ids.pool).toContain(next.currentId)
  })
})
