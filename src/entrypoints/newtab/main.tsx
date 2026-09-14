import { render } from 'preact'

// Self-hosted fonts: latin subsets only, and only the weights the UI uses. Bundled, so there
// are no remote font requests.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/fraunces/latin-400.css'
import '@fontsource/fraunces/latin-500.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'

import { App } from './App'
import './style.css'

const root = document.getElementById('app')
if (root) render(<App />, root)
