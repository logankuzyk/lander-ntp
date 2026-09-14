import { useState } from 'preact/hooks'

import {
  addFavourite,
  moveFavourite,
  normalizeUrl,
  removeFavourite,
  updateFavourite,
  MAX_FAVOURITES,
  type Favourite,
} from '@/favourites/schema'

const ADDRESS_ERROR = 'Enter a site address, like logankuzyk.com'

type FavouritesEditorProps = {
  favourites: Favourite[]
  onChange: (favourites: Favourite[]) => void
}

export function FavouritesEditor({ favourites, onChange }: FavouritesEditorProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = (event: Event) => {
    event.preventDefault()
    if (favourites.length >= MAX_FAVOURITES) {
      setError(`You can save up to ${MAX_FAVOURITES} sites.`)
      return
    }

    const next = addFavourite(favourites, { title, url })
    if (next.length === favourites.length) {
      setError(ADDRESS_ERROR)
      return
    }

    onChange(next)
    setUrl('')
    setTitle('')
    setError(null)
  }

  return (
    <div class="favourites-editor">
      <ul class="favourites-editor__list">
        {/* Address above name, matching the add form: a new site keeps its field order
            when it moves out of the form and into the list. */}
        {favourites.map((favourite, index) => (
          <li key={favourite.id} class="favourites-editor__row">
            {/* The captions are decorative: each input keeps an aria-label naming its site,
                so the rows stay tellable apart when read out one after another. */}
            <label class="favourites-editor__field">
              <span aria-hidden="true">Address</span>
              <input
                aria-label={`Address for ${favourite.title}`}
                value={favourite.url}
                onChange={(event) => {
                  const input = event.currentTarget
                  if (!normalizeUrl(input.value)) {
                    // An address that can't be used leaves the stored one in place, so say so
                    // and put it back rather than letting the field show something that isn't.
                    setError(ADDRESS_ERROR)
                    input.value = favourite.url
                    return
                  }
                  setError(null)
                  onChange(updateFavourite(favourites, favourite.id, { url: input.value }))
                }}
              />
            </label>
            <label class="favourites-editor__field">
              <span aria-hidden="true">Name</span>
              <input
                aria-label={`Name for ${favourite.title}`}
                value={favourite.title}
                onChange={(event) =>
                  onChange(
                    updateFavourite(favourites, favourite.id, { title: event.currentTarget.value }),
                  )
                }
              />
            </label>
            <div class="favourites-editor__actions">
              <button
                type="button"
                aria-label={`Move ${favourite.title} up`}
                disabled={index === 0}
                onClick={() => onChange(moveFavourite(favourites, favourite.id, -1))}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${favourite.title} down`}
                disabled={index === favourites.length - 1}
                onClick={() => onChange(moveFavourite(favourites, favourite.id, 1))}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Remove ${favourite.title}`}
                onClick={() => onChange(removeFavourite(favourites, favourite.id))}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form class="favourites-editor__add" onSubmit={add}>
        <label class="favourites-editor__field">
          <span aria-hidden="true">Address</span>
          <input
            aria-label="Site address"
            placeholder="logankuzyk.com"
            value={url}
            onInput={(event) => setUrl(event.currentTarget.value)}
          />
        </label>
        <label class="favourites-editor__field">
          <span aria-hidden="true">Name</span>
          <input
            aria-label="Name (optional)"
            placeholder="Optional"
            value={title}
            onInput={(event) => setTitle(event.currentTarget.value)}
          />
        </label>
        <button type="submit">Add site</button>
      </form>
      {error && (
        <p class="favourites-editor__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
