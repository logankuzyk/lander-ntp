import { addWidget, type Editable } from '@/layout/ops'

/**
 * What the Add menu says beside its title, if anything: why nothing in it can be added. It is
 * the one place the reasons that apply to the whole menu are decided, so that each is added
 * here and nowhere else:
 *
 * - the Widget limit ("That's all 8 widgets. Remove one to add another.") is the next change;
 * - a Layout written by a newer version ("Update Lander to change this.") is the one after.
 *
 * Nothing stops adding in this version except room, and that is per item (see `itemState`).
 */

export function menuNote(_editable: Editable): string | null {
  return null
}

/**
 * Whether an item of the menu can be picked, and if not, the words beside it. `reason` is null
 * where the menu's own note (or the stored Layout not having arrived yet) explains it.
 */
export type ItemState = { available: false; reason: string | null } | { available: true }

/** "a Weather", "an Analog clock". */
const withArticle = (name: string) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`

/**
 * The state of the item for a type of Widget: unavailable under the menu's note, when the
 * Layout cannot be changed, and when there is no room for the Widget at any size down to its
 * smallest. That is `addWidget`'s own answer, so what the menu says and what a pick does cannot
 * disagree.
 */
export function itemState(
  editable: Editable,
  type: string,
  name: string,
  note: string | null,
): ItemState {
  if (note !== null) return { available: false, reason: null }
  const attempt = addWidget(editable, type)
  if (attempt.ok) return { available: true }
  return {
    available: false,
    reason: attempt.reason === 'no room' ? `There is no room for ${withArticle(name)}.` : null,
  }
}
