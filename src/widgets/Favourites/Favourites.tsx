import type { Favourite } from '@/favourites/schema'
import type { Settings } from '@/settings/schema'

import { FavouriteIcon } from './FavouriteIcon'

type FavouritesProps = {
  favourites: Favourite[]
} & Omit<Settings['favourites'], 'enabled'>

const LIST_ICON = { s: 14, m: 16, l: 20 }
const GRID_ICON = { s: 20, m: 24, l: 32 }

/** Top of the page: inline mentions in list style, or cards in grid style. */
export function Favourites({ favourites, style, size }: FavouritesProps) {
  if (favourites.length === 0) return null
  const iconSize = style === 'list' ? LIST_ICON[size] : GRID_ICON[size]

  return (
    <nav class={`favourites favourites--${style} is-${size}`} aria-label="Favourite sites">
      {favourites.map((favourite) => (
        <a key={favourite.id} class="favourite" href={favourite.url}>
          <FavouriteIcon favourite={favourite} size={iconSize} />
          <span class="favourite__title">{favourite.title}</span>
        </a>
      ))}
    </nav>
  )
}
