/** Trims a site address, adding https to a bare host and rejecting non-web or hostless URLs. */
export function tidyUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null
    return url.href
  } catch {
    return null
  }
}
