# AGENTS.md

Notes for coding agents working on Lander NTP. Start with [README.md](README.md) for what the extension is.

## Working in this repo

- A WXT + Preact browser extension for Chrome, Firefox and Edge. The source is in `src/`, and the only entrypoint is the new tab page (`src/entrypoints/newtab`).
- Before you finish, run `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test`. `npm run build:all` builds all three browsers, and `npm run lint:firefox` checks the Firefox build.
- PR titles follow Conventional Commits (`feat:`, `fix:`, `chore:` …), because release-please builds the changelog from them.
- Stored settings are checked against their current shape (`src/settings/storage.ts`); anything else is replaced by the defaults. Nothing has shipped since 0.1.1, so there are no migrations. When the shape changes, update that check and its tests.
