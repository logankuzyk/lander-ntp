import { canAdd, WIDGET_LIMIT } from '@/layout/limit'
import { addWidget, type Editable } from '@/layout/ops'

/**
 * What the Add menu says beside its title, if anything: why nothing in it can be added. It is
 * the one place the reasons that apply to the whole menu are decided, so that each is added
 * here and nowhere else:
 *
 * - the Widget limit, once the Layout holds as many as are allowed (LR-17). Nothing is said
 *   before then, no count is shown, and no paid tier is mentioned;
 * - a Layout written by a newer version ("Update Lander to change this.") is the next change.
 *
 * Nothing else stops adding in this version except room, and that is per item (see `itemState`).
 * The limit is a parameter so that the line can be tried without one (`null`, a later paid tier).
 */
export function menuNote({ layout }: Editable, limit: number | null = WIDGET_LIMIT): string | null {
  if (limit === null || canAdd(layout, limit)) return null
  return `That's all ${limit} widgets. Remove one to add another.`
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
