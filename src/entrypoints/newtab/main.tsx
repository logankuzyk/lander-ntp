import { render } from 'preact'

// Self-hosted fonts: latin subsets only, and only the weights the UI uses. Bundled, so there
// are no remote font requests. Instrument Serif ships a single weight, by design.
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-mono/latin-400.css'
import '@fontsource/geist-mono/latin-500.css'
import '@fontsource/instrument-serif/latin-400.css'

import { App } from './App'
import './style.css'

const root = document.getElementById('app')
if (root) render(<App />, root)
