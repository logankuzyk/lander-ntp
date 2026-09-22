import { describe, expect, it } from 'vitest'

import { splitScroll, wheelPixels } from './growth'

const wheel = (deltaY: number, deltaMode = 0) => ({ deltaY, deltaMode }) as WheelEvent

describe('wheelPixels', () => {
  it('passes pixels through', () => {
    expect(wheelPixels(wheel(120), 400)).toBe(120)
  })

  it('turns lines and pages into pixels', () => {
    expect(wheelPixels(wheel(3, 1), 400)).toBe(48)
    expect(wheelPixels(wheel(1, 2), 400)).toBe(400)
  })
})

describe('splitScroll', () => {
  it('grows while there is room', () => {
    expect(splitScroll(100, 300)).toEqual({ grow: 100, scroll: 0 })
  })

  it('scrolls whatever growing could not take', () => {
    expect(splitScroll(100, 30)).toEqual({ grow: 30, scroll: 70 })
  })

  it('only scrolls once there is no room', () => {
    expect(splitScroll(100, 0)).toEqual({ grow: 0, scroll: 100 })
  })
})
