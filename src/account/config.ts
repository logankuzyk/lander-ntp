const config = {
  serverUrl: (import.meta.env.WXT_SERVER_URL ?? 'https://api.lander-ntp.com').replace(/\/$/, ''),
}

export default config
