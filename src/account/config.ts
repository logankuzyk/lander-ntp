import { accountServerUrl } from './serverAddress'

const config = { serverUrl: accountServerUrl(import.meta.env.WXT_SERVER_URL) }

export default config
