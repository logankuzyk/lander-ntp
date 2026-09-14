# ntp

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
