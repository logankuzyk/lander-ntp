import type { Cells, WidgetSizes } from '@/widgetSystem/definition'

/** Every whole-cell size a Widget may have, from its smallest through its largest. */
export function allWidgetSizes<O>(sizes: WidgetSizes<O>): Cells[] {
  const { largest, smallest } = sizes
  return Array.from({ length: largest.h - smallest.h + 1 }, (_, dh) =>
    Array.from({ length: largest.w - smallest.w + 1 }, (_, dw) => ({
      h: smallest.h + dh,
      w: smallest.w + dw,
    })),
  ).flat()
}
