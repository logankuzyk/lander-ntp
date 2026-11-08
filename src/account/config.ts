import { accountServerUrl } from './serverAddress'

const mode = import.meta.env.MODE === 'development' ? 'development' : 'production'
const config = { serverUrl: accountServerUrl(import.meta.env.WXT_SERVER_URL, mode) }

export default config
