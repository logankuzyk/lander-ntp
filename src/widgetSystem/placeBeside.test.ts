import { describe, expect, it } from 'vitest'

import { placeBeside } from './placeBeside'

const LAPTOP = { height: 900, width: 1440 }
const PHONE = { height: 800, width: 390 }
const POPOVER = { height: 300, width: 320 }

describe('placeBeside', () => {
  it('prefers the right of the widget, level with its top', () => {
    const anchor = { bottom: 400, left: 100, right: 300, top: 200 }

    expect(placeBeside(anchor, POPOVER, LAPTOP)).toEqual({
      left: 312,
      maxHeight: 300,
      side: 'right',
      top: 200,
    })
  })

  it('flips to the left when the right has no room for its width', () => {
    // The Weather's corner of a 1440 by 900 window: columns 11 and 12.
    const anchor = { bottom: 193, left: 1187, right: 1420, top: 16 }

    expect(placeBeside(anchor, POPOVER, LAPTOP)).toEqual({
      left: 855,
      maxHeight: 300,
      side: 'left',
      top: 16,
    })
  })

  it('keeps its whole height in the window by sliding up from a widget near the bottom', () => {
    const anchor = { bottom: 880, left: 100, right: 300, top: 700 }

    expect(placeBeside(anchor, POPOVER, LAPTOP)).toMatchObject({ side: 'right', top: 592 })
  })

  it('takes the room there is in a window shorter than it, to be scrolled inside', () => {
    const tall = { height: 470, width: 320 }
    const anchor = { bottom: 300, left: 100, right: 300, top: 100 }

    expect(placeBeside(anchor, tall, { height: 480, width: 1366 })).toEqual({
      left: 312,
      maxHeight: 464,
      side: 'right',
      top: 8,
    })
  })

  it('goes below when neither side has the width, if its height fits there', () => {
    // A phone: the Clock in the middle, with 80 pixels either side of it.
    const anchor = { bottom: 450, left: 100, right: 290, top: 283 }

    expect(placeBeside(anchor, { height: 200, width: 320 }, PHONE)).toEqual({
      left: 62,
      maxHeight: 200,
      side: 'below',
      top: 462,
    })
  })

  it('goes above when only that has the height for it', () => {
    const anchor = { bottom: 700, left: 100, right: 290, top: 500 }

    expect(placeBeside(anchor, { height: 400, width: 320 }, PHONE)).toEqual({
      left: 62,
      maxHeight: 400,
      side: 'above',
      top: 88,
    })
  })

  it('goes where there is more room, and scrolls inside it, when neither has the height', () => {
    const anchor = { bottom: 450, left: 100, right: 290, top: 283 }

    expect(placeBeside(anchor, { height: 400, width: 320 }, PHONE)).toEqual({
      left: 62,
      maxHeight: 330,
      side: 'below',
      top: 462,
    })
  })

  it('covers the widget only when there is no room beside, above or below it', () => {
    const anchor = { bottom: 728, left: 20, right: 370, top: 16 }

    expect(placeBeside(anchor, { height: 400, width: 320 }, PHONE)).toEqual({
      left: 35,
      maxHeight: 400,
      side: 'over',
      top: 172,
    })
  })

  it('stays inside the window however wide it is asked to be', () => {
    const anchor = { bottom: 300, left: 10, right: 100, top: 100 }

    const placed = placeBeside(anchor, { height: 200, width: 600 }, { height: 800, width: 360 })

    expect(placed.left).toBeGreaterThanOrEqual(8)
  })

  describe('at the edge of what fits', () => {
    it('takes the right when its width fits exactly, and the left when it is a pixel short', () => {
      // 1440 - 8 (the edge) - (1100 + 12 (the gap)) is 320: just the popover's width.
      const exact = { bottom: 400, left: 700, right: 1100, top: 200 }
      const short = { ...exact, right: 1101 }

      expect(placeBeside(exact, POPOVER, LAPTOP).side).toBe('right')
      expect(placeBeside(short, POPOVER, LAPTOP)).toMatchObject({ left: 368, side: 'left' })
    })

    it('takes the left when its width fits exactly, and goes below when it is a pixel short', () => {
      // 340 - 12 (the gap) - 320 is 8: the popover's left edge on the window's margin.
      const exact = { bottom: 400, left: 340, right: 1130, top: 200 }
      const short = { ...exact, left: 339 }

      expect(placeBeside(exact, POPOVER, LAPTOP)).toMatchObject({ left: 8, side: 'left' })
      expect(placeBeside(short, POPOVER, LAPTOP).side).toBe('below')
    })

    it('prefers below to above when its whole height fits there exactly', () => {
      // 800 - 8 - (520 + 12) is 260, with 480 above: both would hold it, and below comes first.
      const anchor = { bottom: 520, left: 100, right: 290, top: 500 }

      expect(placeBeside(anchor, { height: 260, width: 320 }, PHONE)).toMatchObject({
        maxHeight: 260,
        side: 'below',
      })
    })

    it('goes above or below only with at least 160 pixels there, else over the widget', () => {
      // Below has 800 - 8 - (620 + 12) = 160 and above has 100; a pixel less is over.
      const exact = { bottom: 620, left: 100, right: 290, top: 120 }
      const short = { ...exact, bottom: 621 }
      const tall = { height: 400, width: 320 }

      expect(placeBeside(exact, tall, PHONE)).toMatchObject({ maxHeight: 160, side: 'below' })
      expect(placeBeside(short, tall, PHONE).side).toBe('over')
    })

    it('keeps its right edge inside the window for a popover wider than the window', () => {
      const anchor = { bottom: 300, left: 200, right: 300, top: 100 }
      const viewport = { height: 800, width: 360 }

      const { left } = placeBeside(anchor, { height: 200, width: 600 }, viewport)

      // The room is 344 wide, so it starts at the margin and ends at the other one.
      expect(left + Math.min(600, viewport.width - 16)).toBeLessThanOrEqual(viewport.width - 8)
      expect(left).toBe(8)
    })
  })
})
