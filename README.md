# lander-ntp

A minimal new tab page showing photography from [logankuzyk.com](https://logankuzyk.com), with a clock, an optional weather widget, photo details, and a gallery in settings for picking a photo or a tag to cycle through.

Built with [WXT](https://wxt.dev) and Preact for Chrome, Firefox and Edge.

## Install

- [Chrome Web Store](https://chromewebstore.google.com/detail/lander/ocglhjclnhfbgbccffinhioaangigioa)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/lander-ntp/)

## Development

```bash
npm install
npm run dev          # Chrome (same as dev:chrome)
npm run dev:firefox  # Firefox
npm run dev:edge     # Edge
```

`npm run dev` opens a separate Chrome window with the extension loaded; open a new tab to see it. Changes reload as you save. That window keeps its own profile in `.wxt/chrome-profile`, so your settings carry over between runs. `npm run clean` deletes it (and the build output) to start again from a fresh install. That is also how to see the welcome again: it is shown once, to a new install. To see it (or a feature callout) without starting over, run `chrome.storage.sync.remove('onboarding')` in the new tab's console and reload the extension from `chrome://extensions`, which counts as an update; set `{ onboarding: { dismissed: [], welcomed: false } }` instead for the welcome.

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

The weather widget asks [Open-Meteo](https://open-meteo.com/) directly. If that ever has to change, the same manifest can carry an optional `weather` block, which installed versions pick up with their next manifest refresh:

```json
"weather": {
  "enabled": true,
  "forecastUrl": "https://example.com/v1/forecast",
  "searchUrl": "https://example.com/v1/search"
}
```

Each key is optional. A replacement address must be https, answer the same query parameters in Open-Meteo's response shape, and send `Access-Control-Allow-Origin: *`. `"enabled": false` hides the widget and stops its requests.

## Privacy

Lander collects no personal data. The optional weather widget sends the place you pick to [Open-Meteo](https://open-meteo.com/), whose data (CC BY 4.0) it shows; icons are from [Lucide](https://lucide.dev) (ISC). See [PRIVACY.md](PRIVACY.md) for more information.
