export const PRODUCTION_SERVER_URL = 'https://api.lander-ntp.com'

export type ServerMode = 'development' | 'production'

const loopbackHosts = new Set(['127.0.0.1', '::1', 'localhost'])

export const accountServerUrl = (
  configuredUrl?: string,
  mode: ServerMode = 'production',
): string => {
  const serverUrl = (configuredUrl || PRODUCTION_SERVER_URL).replace(/\/$/, '')
  const url = new URL(serverUrl)
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const isDevelopmentLoopback = mode === 'development' && loopbackHosts.has(hostname)

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isDevelopmentLoopback)) {
    throw new Error('WXT_SERVER_URL must use HTTPS except for loopback development hosts')
  }

  return serverUrl
}

/** The extension needs host access to the origin that serves account requests. */
export const accountHostPermission = (serverUrl: string): string => {
  const url = new URL(serverUrl)
  return `${url.origin}/*`
}
