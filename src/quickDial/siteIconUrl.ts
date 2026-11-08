/** The direct site favicon address. No permission, host access, or third-party icon service. */
export function siteIconUrl(host: string): string {
  return `https://${host}/favicon.ico`
}
