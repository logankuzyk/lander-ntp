export const PRODUCTION_SERVER_URL = 'https://api.lander-ntp.com'

export const accountServerUrl = (configuredUrl?: string): string =>
  (configuredUrl || PRODUCTION_SERVER_URL).replace(/\/$/, '')

/** The extension needs host access to the origin that serves account requests. */
export const accountHostPermission = (serverUrl: string): string => {
  const url = new URL(serverUrl)
  return `${url.origin}/*`
}
