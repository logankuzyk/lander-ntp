# lander-ntp

A minimal new tab page showing photography from [logankuzyk.com](https://logankuzyk.com), with a clock, favourite sites and photo details.

Built with [WXT](https://wxt.dev) and Preact for Chrome, Firefox and Edge.

## Development

```bash
npm install
npm run dev          # Chrome (same as dev:chrome)
npm run dev:firefox  # Firefox
npm run dev:edge     # Edge
```

`npm run dev` opens a separate Chrome window with the extension loaded; open a new tab to see it. Changes reload as you save. That window keeps its own profile in `.wxt/chrome-profile`, so your settings and favourites carry over between runs. `npm run clean` deletes it (and the build output) to start again from a fresh install.

To use a different browser binary or other [web-ext options](https://wxt.dev/guide/essentials/config/browser-startup.html), create a `web-ext.config.ts`. It's gitignored, and overrides the defaults in `wxt.config.ts`:

```ts
import { defineWebExtConfig } from 'wxt'

export default defineWebExtConfig({
  binaries: {
    chrome: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  },
})
```

`npm run build:chrome` and `npm run zip:chrome` (and the `firefox`/`edge` versions) build for one browser, into `.output/`. To try a build in your everyday Chrome, open `chrome://extensions`, turn on **Developer mode**, then **Load unpacked** and pick `.output/chrome-mv3`.

Photos come from `https://logankuzyk.com/new-tab/photos.json` (photos with **Show in new tab** ticked in the website admin). To use a local copy of the website instead, create `.env.local`:

```bash
WXT_PHOTO_MANIFEST_URL=http://localhost:3000/new-tab/photos.json
```
