# lander-ntp

A minimal new tab page showing photography from [logankuzyk.com](https://logankuzyk.com), with a clock, favourite sites and photo details.

Built with [WXT](https://wxt.dev) and Preact for Chrome, Firefox and Edge.

## Development

```bash
npm install
npm run dev          # Chrome
npm run dev:firefox  # Firefox
```

Photos come from `https://logankuzyk.com/new-tab/photos.json` (photos with **Show in new tab** ticked in the website admin). To use a local copy of the website instead, create `.env.local`:

```bash
WXT_PHOTO_MANIFEST_URL=http://localhost:3000/new-tab/photos.json
```

## Usage data

Once a day the extension sends an anonymous heartbeat: a random per-install id, the extension version and browser, and your settings (with the number of favourites, never their addresses). It goes to the Cloudflare Worker in [`telemetry-worker/`](telemetry-worker). You can switch it off under **Settings → Privacy**. On Firefox it is also off unless you allow it in the install prompt or in `about:addons`. Dev builds send nothing unless `WXT_TELEMETRY_DEV=1` is set.
