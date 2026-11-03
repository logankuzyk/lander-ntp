/*
 * How much room a Weather needs, in ems of its own type, so the styles can make the type as big
 * as the box allows (see `.weather` in the page's styles). CSS cannot ask a font how wide a line
 * is, so the width comes from how many characters it draws, at the widest advance of the four
 * fonts; the heights are the rows' own line heights, which the styles and the tests keep equal.
 */

/** The temperature, in ems of the Weather's type. */
export const NOW_SIZE = 2.5
/** The temperature's row: its size at a line height of 1.1. */
export const NOW_HEIGHT = 2.75
/** Between the temperature and the lines under it. */
export const NOW_GAP = 0.4
/** Between the icon and the temperature, in ems of the temperature. */
export const NOW_ICON_GAP = 0.25
/** One line of text. */
export const LINE_HEIGHT = 1.25
/** Between one line and the next. */
export const LINE_GAP = 0.125
/**
 * What a character is across, at the widest of the four fonts (Geist Mono's advance, which every
 * character shares; the others are narrower). Measured; see the pull request.
 */
export const CHAR_WIDTH = 0.6
/**
 * Room to spare across, for what no measurement of four fonts shows: another platform's System
 * font, a size under 6px (Chrome draws type no smaller, so a line is up to 2% wider than its
 * size says), rounding. The widest line then fills 97% of the box at most.
 */
export const SLACK = 1.03
/** A place's name is drawn this many characters across and cut short after, not made room for. */
export const PLACE_CHARS = 16
/** The sunrise and sunset line: two icons (1.15), two times of five characters, and its gaps. */
export const SUN_WIDTH = 2 * 1.15 + 2 * 5 * CHAR_WIDTH + 4 * 0.375

type WeatherFitInput = {
  /** The text of the lines under the temperature, other than the place and the sun. */
  lines: readonly string[]
  /** The place's name, if its line is on. */
  place: string | null
  /** Whether the sunrise and sunset line is on. */
  sun: boolean
  /** As drawn, with its sign and degree mark. */
  temperature: string
}

/** The room the Weather needs: the width of its widest row and its height, in ems of its type. */
export function weatherFit({ lines, place, sun, temperature }: WeatherFitInput) {
  const rows = lines.length + (place === null ? 0 : 1) + (sun ? 1 : 0)
  const now = NOW_SIZE * (1 + NOW_ICON_GAP + temperature.length * CHAR_WIDTH)
  const widths = [
    now,
    ...lines.map((line) => line.length * CHAR_WIDTH),
    ...(place === null ? [] : [Math.min(place.length, PLACE_CHARS) * CHAR_WIDTH]),
    ...(sun ? [SUN_WIDTH] : []),
  ]
  return {
    height: NOW_HEIGHT + (rows > 0 ? NOW_GAP + rows * LINE_HEIGHT + (rows - 1) * LINE_GAP : 0),
    width: Math.max(...widths) * SLACK,
  }
}
