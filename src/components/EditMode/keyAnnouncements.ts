import type { Rect } from '@/layout/geometry'

import type { KeySession } from './moveSession'

/**
 * What the page says, to people who cannot see the Grid, while a Widget is picked up from the
 * keyboard (see `useGridKeys`). Plain sentences, said once each by the Grid's polite live region:
 * the Widget's name only when it is picked up and put down, and the place or size on each step,
 * so that a run of key presses is not a run of repeated names.
 */

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

const where = ({ col, row }: Rect) => `column ${col}, row ${row}`
const sizeOf = ({ h, w }: Rect) => `${plural(w, 'column')} by ${plural(h, 'row')}`

const sameCells = (a: Rect, b: Rect) =>
  a.col === b.col && a.row === b.row && a.w === b.w && a.h === b.h

/** Said when a Widget is picked up: where it is and the keys that act on it. */
export function pickedUp(name: string, session: KeySession): string {
  const keys = 'Arrow keys move it, Enter puts it down, Escape puts it back.'
  const resize = session.definition ? ' Shift with the arrow keys resizes it.' : ''
  return `${name} picked up at ${where(session.place)}. ${keys}${resize}`
}

/** What stopped a step short, in a few words, or nothing where it went through. */
function note(session: KeySession): string {
  const parts: string[] = []
  if (session.limit === 'edge') parts.push('Edge of the grid.')
  if (session.limit === 'largest') parts.push('Largest size.')
  if (session.limit === 'smallest') parts.push('Smallest size.')
  if (!session.valid) parts.push('Another widget is there.')
  return parts.length === 0 ? '' : ` ${parts.join(' ')}`
}

/** Said after an arrow key moved it: the place it is at now. */
export function moved(session: KeySession): string {
  return `Column ${session.place.col}, row ${session.place.row}.${note(session)}`
}

/** Said after Shift and an arrow key resized it: the size it is now. */
export function resized(session: KeySession): string {
  return `${sizeOf(session.place)}.${note(session)}`
}

/** Said when a Widget cannot be resized (a type this version does not know). */
export function cannotResize(name: string): string {
  return `${name} can't be resized.`
}

/** Said when Enter is pressed on a place that is refused: it stays up. */
export function cannotPutDown(name: string, session: KeySession): string {
  return `${name} can't be put down at ${where(session.place)}. Another widget is there.`
}

/** Said when a Widget is put down: where, and its size if that changed. */
export function putDown(name: string, session: KeySession): string {
  if (sameCells(session.place, session.origin)) return `${name} put down where it was.`
  const size = session.place.w === session.origin.w && session.place.h === session.origin.h
  return `${name} put down at ${where(session.place)}${size ? '' : `, ${sizeOf(session.place)}`}.`
}

/** Said when a Widget that was valid could not be put down after all (the Layout changed). */
export function couldNotPutDown(name: string): string {
  return `${name} couldn't be put down there. It went back.`
}

/** Said when a Widget is put back where it was picked up. */
export function putBack(name: string, session: KeySession): string {
  return `${name} put back at ${where(session.origin)}.`
}
