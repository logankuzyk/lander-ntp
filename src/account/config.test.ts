describe('account server address', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses the production account server by default', async () => {
    vi.stubEnv('WXT_SERVER_URL', '')
    vi.resetModules()
    const config = await import('./config')

    expect(config.default.serverUrl).toBe('https://api.lander-ntp.com')
  })

  it('removes a trailing slash from the configured server address', async () => {
    vi.stubEnv('WXT_SERVER_URL', 'https://account.example.test/')
    vi.resetModules()
    const config = await import('./config')

    expect(config.default.serverUrl).toBe('https://account.example.test')
  })
})
