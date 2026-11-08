import { accountServerUrl } from './serverAddress'

describe('account server URL validation', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'allows http on loopback host %s during development',
    (host) => {
      expect(accountServerUrl(`http://${host}:3000`, 'development')).toBe(`http://${host}:3000`)
    },
  )

  it('allows HTTPS account servers in production', () => {
    expect(accountServerUrl('https://accounts.example.test', 'production')).toBe(
      'https://accounts.example.test',
    )
  })

  it('rejects HTTP on non-loopback hosts, including in development', () => {
    expect(() => accountServerUrl('http://accounts.example.test', 'development')).toThrow(
      'WXT_SERVER_URL must use HTTPS except for loopback development hosts',
    )
  })

  it('rejects HTTP even on loopback in production builds', () => {
    expect(() => accountServerUrl('http://localhost:3000', 'production')).toThrow(
      'WXT_SERVER_URL must use HTTPS except for loopback development hosts',
    )
  })

  it('rejects non-HTTPS schemes', () => {
    expect(() => accountServerUrl('ftp://accounts.example.test', 'development')).toThrow(
      'WXT_SERVER_URL must use HTTPS except for loopback development hosts',
    )
  })
})
