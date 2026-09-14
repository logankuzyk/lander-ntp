export type Favourite = {
  id: string
  title: string
  url: string
}

/**
 * `storage.sync` allows roughly 8KB per item, which is a few hundred entries. Cap well under
 * that so a long title can't push the list over the quota.
 */
export const MAX_FAVOURITES = 50

/**
 * Accept what someone would type ("logankuzyk.com", "example.com/path") and return a usable
 * http(s) URL, or null when it can't be one.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname.includes('.')) return null
  return url.href
}

/** Fallback title: the hostname without "www.". */
export function defaultTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const newId = () => globalThis.crypto.randomUUID()

export function makeFavourite(
  input: { title?: string; url: string },
  id: string = newId(),
): Favourite | null {
  const url = normalizeUrl(input.url)
  if (!url) return null
  return { id, title: input.title?.trim() || defaultTitle(url), url }
}

/** Appends a site. Returns the list unchanged when the URL is unusable or the cap is reached. */
export function addFavourite(
  favourites: readonly Favourite[],
  input: { title?: string; url: string },
  id?: string,
): Favourite[] {
  if (favourites.length >= MAX_FAVOURITES) return [...favourites]
  const favourite = makeFavourite(input, id)
  return favourite ? [...favourites, favourite] : [...favourites]
}

/** Edits a site. An empty title falls back to the hostname; an unusable URL is ignored. */
export function updateFavourite(
  favourites: readonly Favourite[],
  id: string,
  changes: Partial<Omit<Favourite, 'id'>>,
): Favourite[] {
  return favourites.map((favourite) => {
    if (favourite.id !== id) return favourite
    const url =
      changes.url === undefined ? favourite.url : (normalizeUrl(changes.url) ?? favourite.url)
    const title = changes.title === undefined ? favourite.title : changes.title.trim()
    return { ...favourite, url, title: title || defaultTitle(url) }
  })
}

export function removeFavourite(favourites: readonly Favourite[], id: string): Favourite[] {
  return favourites.filter((favourite) => favourite.id !== id)
}

/** Moves a site one place up (-1) or down (1). Ends of the list stay put. */
export function moveFavourite(
  favourites: readonly Favourite[],
  id: string,
  direction: -1 | 1,
): Favourite[] {
  const from = favourites.findIndex((favourite) => favourite.id === id)
  const to = from + direction
  if (from === -1 || to < 0 || to >= favourites.length) return [...favourites]

  const next = [...favourites]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved as Favourite)
  return next
}
