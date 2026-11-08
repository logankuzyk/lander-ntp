import { browser } from 'wxt/browser'

import config from '../../wxt.config'
import { requestSignInConsent, signInConsented } from './consent'

const SIGN_IN_DATA = ['locationInfo', 'personallyIdentifyingInfo', 'authenticationInfo']

describe('sign-in consent', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('keeps Firefox data consent optional in the manifest', async () => {
    if (typeof config.manifest !== 'function') throw new Error('Firefox manifest must be generated')
    const manifest = await config.manifest({
      browser: 'firefox',
      command: 'build',
      manifestVersion: 3,
      mode: 'production',
    })

    expect(manifest?.browser_specific_settings?.gecko?.data_collection_permissions).toEqual({
      optional: SIGN_IN_DATA,
      required: ['none'],
    })
  })

  it('asks Firefox to consent to all data sent by sync', async () => {
    vi.stubEnv('BROWSER', 'firefox')
    const request = vi.spyOn(browser.permissions, 'request').mockResolvedValue(true as never)

    await expect(requestSignInConsent()).resolves.toBe(true)
    expect(request).toHaveBeenCalledWith({ data_collection: SIGN_IN_DATA })
  })

  it('returns false when Firefox refuses or cannot ask for consent', async () => {
    vi.stubEnv('BROWSER', 'firefox')
    const request = vi.spyOn(browser.permissions, 'request')
    request.mockResolvedValueOnce(false as never)
    await expect(requestSignInConsent()).resolves.toBe(false)
    request.mockRejectedValueOnce(new Error('permission API unavailable'))
    await expect(requestSignInConsent()).resolves.toBe(false)
  })

  it.each(['chrome', 'edge'])('treats pressing Send code as consent on %s', async (browserName) => {
    vi.stubEnv('BROWSER', browserName)
    const request = vi.spyOn(browser.permissions, 'request')
    const contains = vi.spyOn(browser.permissions, 'contains')

    await expect(requestSignInConsent()).resolves.toBe(true)
    await expect(signInConsented()).resolves.toBe(true)
    expect(request).not.toHaveBeenCalled()
    expect(contains).not.toHaveBeenCalled()
  })

  it('requires all three Firefox data consents to remain present', async () => {
    vi.stubEnv('BROWSER', 'firefox')
    const contains = vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true as never)

    await expect(signInConsented()).resolves.toBe(true)
    expect(contains).toHaveBeenCalledWith({ data_collection: SIGN_IN_DATA })
    contains.mockResolvedValueOnce(false as never)
    await expect(signInConsented()).resolves.toBe(false)
  })

  it('returns false when Firefox cannot check consent', async () => {
    vi.stubEnv('BROWSER', 'firefox')
    vi.spyOn(browser.permissions, 'contains').mockRejectedValue(
      new Error('permission API unavailable'),
    )

    await expect(signInConsented()).resolves.toBe(false)
  })
})
