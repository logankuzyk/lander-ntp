# AGENTS.md

Notes for coding agents working on Lander NTP. Start with [README.md](README.md) for what the extension is.

## Working in this repo

- A WXT + Preact browser extension for Chrome, Firefox and Edge. The source is in `src/`. The new tab page (`src/entrypoints/newtab`) is the whole product; the background script (`src/entrypoints/background.ts`) only records whether this is a new install or an update.
- Before you finish, run `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test`. `npm run build:all` builds all three browsers, and `npm run lint:firefox` checks the Firefox build.
- PR titles follow Conventional Commits (`feat:`, `fix:`, `chore:` …), because release-please builds the changelog from them.
- Stored settings are checked against their current shape (`src/settings/storage.ts`); anything else is replaced by the defaults. There are no migrations; a block added after a release (like `weather`, after 0.2.x) is optional in the check and filled in with its defaults, so settings already stored survive. When the shape changes, update that check and its tests.
- Onboarding lives in `src/onboarding`. A new install gets the welcome and a tour of the settings (`TOUR` in `callouts.ts`); an update gets the callouts in `NEWS`, once each. To announce a feature, add an entry to `NEWS` with a new `id` and, if it needs a new spot on the page, a `callout--<section>` rule in `style.css`.
