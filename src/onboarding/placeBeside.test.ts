import { describe, expect, it } from 'vitest'

import { type Edges, placeBeside } from './placeBeside'

const LAPTOP = { height: 900, width: 1440 }
const CALLOUT = { height: 140, width: 256 }

const edges = (left: number, top: number, right: number, bottom: number): Edges => ({
  bottom,
  left,
  right,
  top,
})

const overlaps = (a: Edges, b: Edges) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** The callout's box, as placed. */
const boxOf = (at: { left: number; top: number }, size = CALLOUT): Edges =>
  edges(at.left, at.top, at.left + size.width, at.top + size.height)

describe('placeBeside', () => {
  const target = edges(600, 200, 800, 400)

  it('goes to the right of the target, level with its middle, when it can', () => {
    expect(placeBeside(target, CALLOUT, LAPTOP)).toEqual({
      left: 812,
      pointer: 70,
      side: 'right',
      top: 230,
    })
  })

  it('goes to the left of the target when it is asked to', () => {
    expect(placeBeside(target, CALLOUT, LAPTOP, { prefer: ['left'] })).toEqual({
      left: 332,
      pointer: 70,
      side: 'left',
      top: 230,
    })
  })

  it('goes below the target, centred on it', () => {
    expect(placeBeside(target, CALLOUT, LAPTOP, { prefer: ['below'] })).toEqual({
      left: 572,
      pointer: 128,
      side: 'below',
      top: 412,
    })
  })

  it('goes above the target, centred on it', () => {
    expect(placeBeside(target, CALLOUT, LAPTOP, { prefer: ['above'] })).toEqual({
      left: 572,
      pointer: 128,
      side: 'above',
      top: 48,
    })
  })

  it('tries the right, then the left, below and above, when it is not asked for a side', () => {
    // Nothing on the right (the target is at the window's edge) or on the left.
    const wide = edges(8, 300, 1432, 500)
    expect(placeBeside(wide, CALLOUT, LAPTOP).side).toBe('below')
    expect(placeBeside(edges(8, 300, 1432, 880), CALLOUT, LAPTOP).side).toBe('above')
  })

  describe('flips at the window’s edges', () => {
    it('to the left, when the right has no room for its width', () => {
      const corner = edges(1187, 16, 1420, 193)

      expect(placeBeside(corner, CALLOUT, LAPTOP)).toMatchObject({ left: 919, side: 'left' })
    })

    it('to the right, when the left has none', () => {
      const edge = edges(20, 300, 120, 400)

      expect(placeBeside(edge, CALLOUT, LAPTOP, { prefer: ['left'] }).side).toBe('right')
    })

    it('to above, when there is nothing below', () => {
      const foot = edges(600, 820, 700, 860)

      expect(placeBeside(foot, CALLOUT, LAPTOP, { prefer: ['below', 'above'] })).toMatchObject({
        side: 'above',
        top: 668,
      })
    })

    it('to below, when there is nothing above', () => {
      const head = edges(600, 16, 700, 56)

      expect(placeBeside(head, CALLOUT, LAPTOP, { prefer: ['above', 'below'] })).toMatchObject({
        side: 'below',
        top: 68,
      })
    })

    it('goes on to a side it was not asked for before it gives up on the ones it was', () => {
      const foot = edges(600, 820, 700, 860)

      expect(placeBeside(foot, CALLOUT, LAPTOP, { prefer: ['below'] }).side).not.toBe('below')
    })
  })

  describe('stays in the window along its side', () => {
    it('slid right of the left edge, with the pointer still at the target', () => {
      const near = edges(10, 500, 50, 540)

      expect(placeBeside(near, CALLOUT, LAPTOP, { prefer: ['above'] })).toMatchObject({
        left: 8,
        pointer: 22,
        side: 'above',
      })
    })

    it('slid left of the right edge', () => {
      const near = edges(1390, 500, 1430, 540)
      const placed = placeBeside(near, CALLOUT, LAPTOP, { prefer: ['above'] })

      expect(placed.left).toBe(1440 - 8 - 256)
      expect(placed.pointer).toBe(1410 - placed.left)
    })

    it('slid down from the top, and up from the bottom', () => {
      const top = placeBeside(edges(600, 0, 700, 40), CALLOUT, LAPTOP, { prefer: ['right'] })
      const bottom = placeBeside(edges(600, 860, 700, 900), CALLOUT, LAPTOP, { prefer: ['right'] })

      expect(top.top).toBe(8)
      expect(bottom.top).toBe(900 - 8 - 140)
    })

    it('keeps its pointer off the corners, however far the target is along', () => {
      const corner = edges(0, 500, 20, 540)

      const { pointer } = placeBeside(corner, CALLOUT, LAPTOP, { prefer: ['above'] })

      expect(pointer).toBe(20)
      expect(
        placeBeside(edges(1420, 500, 1440, 540), CALLOUT, LAPTOP, { prefer: ['above'] }).pointer,
      ).toBe(256 - 20)
    })
  })

  describe('keeps clear of what is open', () => {
    it('takes the next side when a popover is where the first would go', () => {
      const popover = edges(512, 0, 900, 900)
      const beside = edges(300, 200, 500, 400)

      expect(placeBeside(beside, CALLOUT, LAPTOP, { avoid: [popover] })).toMatchObject({
        left: 32,
        side: 'left',
      })
    })

    it('does not mind a rect it only touches', () => {
      const touching = edges(900, 0, 1000, 900)
      // The callout ends at 1068 on the right, so this one overlaps it; one at its edge would not.
      expect(placeBeside(target, CALLOUT, LAPTOP, { avoid: [touching] }).side).not.toBe('right')
      const edge = edges(1068, 0, 1100, 900)
      expect(placeBeside(target, CALLOUT, LAPTOP, { avoid: [edge] }).side).toBe('right')
    })

    it('takes the side that overlaps least when every side is covered', () => {
      const avoid = [
        edges(800, 300, 1100, 500), // all of the right
        edges(332, 300, 360, 500), // a sliver of the left
        edges(0, 505, 1440, 700), // all of below
        edges(0, 100, 1440, 290), // all of above
      ]
      const middle = edges(600, 300, 800, 500)

      expect(placeBeside(middle, CALLOUT, LAPTOP, { avoid }).side).toBe('left')
    })

    it('does not move for a rect that is nowhere near', () => {
      expect(placeBeside(target, CALLOUT, LAPTOP, { avoid: [edges(0, 0, 50, 50)] }).side).toBe(
        'right',
      )
    })
  })

  describe('for a target in something else, such as an item of a menu', () => {
    const item = edges(910, 520, 1090, 550)
    const menu = edges(900, 500, 1100, 700)

    it('goes beside the menu, level with the item', () => {
      expect(placeBeside(item, CALLOUT, LAPTOP, { prefer: ['left'], within: menu })).toEqual({
        left: 900 - 12 - 256,
        pointer: 70,
        side: 'left',
        top: 465,
      })
      expect(placeBeside(item, CALLOUT, LAPTOP, { prefer: ['right'], within: menu })).toMatchObject(
        {
          left: 1100 + 12,
          side: 'right',
        },
      )
    })

    it('goes above or below the menu, centred on the item', () => {
      expect(placeBeside(item, CALLOUT, LAPTOP, { prefer: ['above'], within: menu })).toMatchObject(
        {
          left: 1000 - 128,
          side: 'above',
          top: 500 - 12 - 140,
        },
      )
      expect(placeBeside(item, CALLOUT, LAPTOP, { prefer: ['below'], within: menu })).toMatchObject(
        {
          side: 'below',
          top: 700 + 12,
        },
      )
    })

    it('flips by the room beside the menu, not beside the item', () => {
      // The menu starts at 280, which has room for the callout on its left; one starting at 100 has not.
      const near = edges(300, 520, 480, 550)
      const menuLeft = edges(280, 500, 500, 700)

      expect(placeBeside(near, CALLOUT, LAPTOP, { prefer: ['left'], within: menuLeft }).side).toBe(
        'left',
      )
      expect(
        placeBeside(near, CALLOUT, LAPTOP, { prefer: ['left'], within: edges(100, 500, 500, 700) })
          .side,
      ).toBe('right')
    })
  })

  describe('in a window with no room', () => {
    it('stays whole in the window, on the side with the most room', () => {
      const tiny = { height: 200, width: 300 }
      const middle = edges(120, 80, 180, 120)

      const placed = placeBeside(middle, CALLOUT, tiny)
      const box = boxOf(placed)

      expect(box.left).toBeGreaterThanOrEqual(8)
      expect(box.top).toBeGreaterThanOrEqual(8)
      expect(box.right).toBeLessThanOrEqual(292)
      expect(box.bottom).toBeLessThanOrEqual(192)
    })

    it('starts at the window’s edge when it is larger than the window', () => {
      const placed = placeBeside(
        edges(10, 10, 30, 30),
        { height: 500, width: 500 },
        {
          height: 200,
          width: 300,
        },
      )

      expect([placed.left, placed.top]).toEqual([8, 8])
    })

    it('a phone: beside nothing, so above or below', () => {
      const phone = { height: 800, width: 390 }
      const clock = edges(100, 283, 290, 450)

      const placed = placeBeside(clock, CALLOUT, phone)

      expect(['above', 'below']).toContain(placed.side)
      expect(overlaps(boxOf(placed), clock)).toBe(false)
    })
  })

  describe('at the very edge of fitting', () => {
    // 256 wide and 140 tall, 12 from the target, and 8 from the window's edge.
    it('takes the right when it fits exactly, and not when it is a pixel short', () => {
      expect(placeBeside(edges(1000, 200, 1164, 400), CALLOUT, LAPTOP).side).toBe('right')
      expect(placeBeside(edges(1000, 200, 1165, 400), CALLOUT, LAPTOP).side).toBe('left')
    })

    it('takes the left when it fits exactly, and not when it is a pixel short', () => {
      expect(
        placeBeside(edges(276, 200, 400, 400), CALLOUT, LAPTOP, { prefer: ['left'] }),
      ).toMatchObject({
        left: 8,
        side: 'left',
      })
      expect(
        placeBeside(edges(275, 200, 400, 400), CALLOUT, LAPTOP, { prefer: ['left'] }).side,
      ).toBe('right')
    })

    it('takes below when it fits exactly, and not when it is a pixel short', () => {
      expect(
        placeBeside(edges(600, 700, 700, 740), CALLOUT, LAPTOP, { prefer: ['below'] }),
      ).toMatchObject({
        side: 'below',
        top: 752,
      })
      expect(
        placeBeside(edges(600, 700, 700, 741), CALLOUT, LAPTOP, { prefer: ['below'] }).side,
      ).toBe('right')
    })

    it('takes above when it fits exactly, and not when it is a pixel short', () => {
      expect(
        placeBeside(edges(600, 160, 700, 200), CALLOUT, LAPTOP, { prefer: ['above'] }),
      ).toMatchObject({
        side: 'above',
        top: 8,
      })
      expect(
        placeBeside(edges(600, 159, 700, 200), CALLOUT, LAPTOP, { prefer: ['above'] }).side,
      ).toBe('right')
    })
  })

  it('takes the side with the most room when none has enough', () => {
    // A small window: the room on the right is -236, on the left -76, below -80 and above -100.
    const small = { height: 200, width: 300 }
    const target = edges(200, 60, 260, 120)

    const placed = placeBeside(target, CALLOUT, small)

    expect(placed.side).toBe('left')
    // Slid into the window, level with the target's middle (90, less half the callout).
    expect([placed.left, placed.top]).toEqual([8, 20])
  })

  it('never covers the target where any side has room', () => {
    for (let left = 0; left <= 1340; left += 134) {
      for (let top = 0; top <= 800; top += 100) {
        const each = edges(left, top, left + 100, top + 100)
        const placed = placeBeside(each, CALLOUT, LAPTOP)

        expect(overlaps(boxOf(placed), each)).toBe(false)
      }
    }
  })
})

describe('placeBeside, keeping clear of what stays on the page', () => {
  const PHONE = { height: 800, width: 390 }
  // The Edit button in the Bottom bar, and the photo credit, wrapped to three lines, at the left.
  const edit = edges(200, 744, 240, 784)
  const credit = edges(24, 715, 138, 732)

  it('puts a note above its target on the page, as it would be, when nothing is in the way', () => {
    const placed = placeBeside(edit, CALLOUT, PHONE, { prefer: ['above'] })

    expect(placed).toMatchObject({ left: 92, side: 'above', top: 592 })
    expect(overlaps(boxOf(placed), credit)).toBe(true)
  })

  it('lifts a note above its target clear of the credit, 8 pixels clear, and keeps it in line', () => {
    const placed = placeBeside(edit, CALLOUT, PHONE, { keepClear: [credit], prefer: ['above'] })

    expect(placed.side).toBe('above')
    expect(placed.left).toBe(92)
    expect(placed.top).toBe(715 - 8 - 140)
    expect(overlaps(boxOf(placed), credit)).toBe(false)
    // The pointer still faces the middle of the target, along the note's lower edge.
    expect(placed.pointer).toBe(220 - 92)
  })

  it('lowers a note below its target clear of what is under it', () => {
    const target = edges(100, 100, 140, 140)
    const bar = edges(0, 160, 390, 180)

    const placed = placeBeside(target, CALLOUT, PHONE, { keepClear: [bar], prefer: ['below'] })

    expect(placed.side).toBe('below')
    expect(placed.top).toBe(180 + 8)
    expect(overlaps(boxOf(placed), bar)).toBe(false)
  })

  it('does not move a note that is not over what stays', () => {
    const far = edges(300, 10, 380, 30)

    expect(placeBeside(edit, CALLOUT, PHONE, { keepClear: [far], prefer: ['above'] })).toEqual(
      placeBeside(edit, CALLOUT, PHONE, { prefer: ['above'] }),
    )
  })

  it('does not lift it further than it is worth, which would leave it with nothing near the target', () => {
    const tall = edges(24, 600, 138, 732)

    const placed = placeBeside(edit, CALLOUT, PHONE, { keepClear: [tall], prefer: ['above'] })

    // 592 is where it would go; clearing 600 would take it 140 pixels higher.
    expect(placed.top).toBe(592)
  })

  it('stays inside the window', () => {
    const target = edges(100, 30, 140, 60)
    const above = edges(0, 0, 390, 20)

    const placed = placeBeside(target, CALLOUT, PHONE, { keepClear: [above], prefer: ['below'] })

    expect(placed.top).toBeGreaterThanOrEqual(8)
    expect(boxOf(placed).bottom).toBeLessThanOrEqual(PHONE.height - 8)
  })

  it('takes a side that is clear in preference to one that is not, before it moves anything', () => {
    const middle = edges(600, 200, 800, 400)
    // Covers where the callout goes to the right of the target.
    const over = edges(812, 220, 1068, 380)

    const placed = placeBeside(middle, CALLOUT, LAPTOP, { keepClear: [over] })

    expect(placed.side).toBe('left')
  })
})
