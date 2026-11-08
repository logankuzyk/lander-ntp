import { browser } from 'wxt/browser'

import config from '../../wxt.config'
import accountConfig from './config'
import { requestSignInConsent, signInConsented } from './consent'
import { accountHostPermission } from './serverAddress'

const SIGN_IN_DATA = ['locationInfo', 'personallyIdentifyingInfo', 'authenticationInfo']
const ACCOUNT_ORIGIN = [accountHostPermission(accountConfig.serverUrl)]

describe('sign-in consent', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

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

  it('grants host access to the configured account server origin', async () => {
    if (typeof config.manifest !== 'function') throw new Error('Manifest must be generated')
    vi.stubEnv('WXT_SERVER_URL', 'https://account.example.test:8443/base')

    const manifest = await config.manifest({
      browser: 'chrome',
      command: 'build',
      manifestVersion: 3,
      mode: 'production',
    })

    expect(manifest?.optional_host_permissions).toEqual(['https://account.example.test:8443/*'])
  })

  it('asks Firefox to consent to all data sent by sync', async () => {
    vi.stubEnv('BROWSER', 'firefox')
    const request = vi.spyOn(browser.permissions, 'request').mockResolvedValue(true as never)

    await expect(requestSignInConsent()).resolves.toBe(true)
    expect(request).toHaveBeenCalledWith({
      data_collection: SIGN_IN_DATA,
      origins: ACCOUNT_ORIGIN,
    })
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
    const request = vi.spyOn(browser.permissions, 'request').mockResolvedValue(true as never)
    const contains = vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true as never)

    await expect(requestSignInConsent()).resolves.toBe(true)
    await expect(signInConsented()).resolves.toBe(true)
    expect(request).toHaveBeenCalledWith({ origins: ACCOUNT_ORIGIN })
    expect(contains).toHaveBeenCalledWith({ origins: ACCOUNT_ORIGIN })
  })

  it('requires all three Firefox data consents to remain present', async () => {
    vi.stubEnv('BROWSER', 'firefox')
    const contains = vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true as never)

    await expect(signInConsented()).resolves.toBe(true)
    expect(contains).toHaveBeenCalledWith({
      data_collection: SIGN_IN_DATA,
      origins: ACCOUNT_ORIGIN,
    })
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
