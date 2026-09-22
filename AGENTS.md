# AGENTS.md

Notes for coding agents working on Lander NTP. Start with [README.md](README.md) for what the extension is.

## Working in this repo

- A WXT + Preact browser extension for Chrome, Firefox and Edge. The source is in `src/`, and the only entrypoint is the new tab page (`src/entrypoints/newtab`).
- Before you finish, run `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test`. `npm run build:all` builds all three browsers, and `npm run lint:firefox` checks the Firefox build.
- `telemetry-worker/` is a separate Cloudflare Worker package with its own `package.json`, and root tooling skips it. Run `npm test` and `npm run typecheck` inside it.
- PR titles follow Conventional Commits (`feat:`, `fix:`, `chore:` …), because release-please builds the changelog from them.
- Stored settings are checked against their current shape (`src/settings/storage.ts`); anything else is replaced by the defaults. Nothing has shipped since 0.1.1, so there are no migrations. When the shape changes, update that check and its tests.

## Tracking plan

Telemetry exists to answer a few questions: how many installs are active, which settings people pick, which photos they like, and whether the links through to logankuzyk.com get used. The code is in `src/telemetry/` (extension) and `telemetry-worker/` (the endpoint, which writes to Workers Analytics Engine).

### Rules

- **Pseudonymous, not anonymous.** The only identifier is a random UUID kept in `local:` storage. It counts installs, not people, and is deleted on uninstall. It is stable, and the Worker sees it next to the client IP, so don't call the data anonymous. The Worker never stores or logs IPs, `request.cf` or headers: it uses `CF-Connecting-IP` only as a rate-limiter key, and `wrangler.jsonc` turns Workers Logs invocation logs off because they would record request metadata. Never `console.log` a request or its headers.
- **No browsing data.** Never send URLs, page titles or free text. Values must be enums, booleans, counts, or ids of photos published on logankuzyk.com.
- **Name each property.** Build props field by field, as `heartbeatProps` does. Never spread settings or objects into an event, because a setting added later would then leave the browser unnoticed.
- **Consent.** Nothing is sent, and the settings switch is hidden, unless the build sets `WXT_TELEMETRY_ENABLED=1` (see [Turning telemetry on](#turning-telemetry-on)). With it, `track()` sends only when `settings.telemetry` is on (the default), _and_ Firefox's `technicalAndInteraction` consent is granted (a Firefox build that finds no answer takes it as a no). Dev builds send nothing unless `WXT_TELEMETRY_DEV=1` is set as well.
- **Fire and forget.** `track()` never throws and never retries. Call it as `void track(…)`, and don't let UI wait on it.
- **Naming.** `snake_case`, object then past-tense verb: `photo_liked`, `link_clicked`.

### Envelope

Every event carries these fields in addition to its own `event` and `props`:

| Field       | Example                                | Source                                 |
| ----------- | -------------------------------------- | -------------------------------------- |
| `installId` | `6f1c1b0e-8d5f-4c1a-9b8e-2a7c3d4e5f60` | `local:telemetryId`, made on first use |
| `version`   | `0.2.0`                                | `browser.runtime.getManifest()`        |
| `browser`   | `chrome` \| `firefox` \| `edge`        | `import.meta.env.BROWSER`              |

The Worker's own timestamp is the event time. Clients don't send one.

### Events

| Event                           | Status  | Fired when                                                        | Props                                                                                                                        |
| ------------------------------- | ------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `heartbeat`                     | Live    | The first new tab of each UTC day                                 | `photos.{mode,frequency,tags}` (tags is how many, never which), `font`, `dim`, `clock.{enabled,hour12,showDate,showSeconds}` |
| `photo_liked` / `photo_unliked` | Planned | The thumbs-up button (or `l` key) is toggled                      | `photoId`                                                                                                                    |
| `setting_changed`               | Planned | A setting changes in the settings panel, once per changed setting | `key` (dotted path, e.g. `clock.showSeconds`), `value` (enum or boolean). Never sent for the usage data switch itself.       |
| `link_clicked`                  | Planned | A link is opened                                                  | `kind`: `print` \| `photo_page`, with `photoId`.                                                                             |

`telemetry-worker/README.md` lists the Analytics Engine column each prop is stored in, with example queries.

### Adding or changing an event

1. Update the table above first. If the event needs data outside these rules, stop and ask.
2. Add it to the `TelemetryEvent` union in `src/telemetry/events.ts`, and call `track()` where it happens.
3. Add its valibot schema to `EventSchema` in `telemetry-worker/src/schema.ts`, and map it in `toDataPoint`.
   - `blob1`–`blob3` (event, browser, version) and `index1` (install id) are the same for every event. The rest are per event, so queries must filter on `blob1`.
   - Columns are positional: add new ones at the end and never reorder existing ones.
4. Document the columns in `telemetry-worker/README.md`.
5. Test both sides: that the event is sent with the right props, and that it is dropped when consent is off (see `src/telemetry/client.test.ts`). In the Worker, check that the event is accepted, written to the right columns, and rejected when malformed (`telemetry-worker/src/handler.test.ts`).
6. Deploy the Worker before releasing an extension version that sends the new event. Until then the Worker rejects it with a 400 and the event is lost.
7. Anything beyond technical and interaction data also needs a new Firefox `data_collection_permissions` entry in `wxt.config.ts` and updated store privacy disclosures.

### Checking it locally

Run `npm run dev` in `telemetry-worker/`. Then set `WXT_TELEMETRY_URL=http://localhost:8787/events`, `WXT_TELEMETRY_ENABLED=1` and `WXT_TELEMETRY_DEV=1` in the root `.env.local`, and run `npm run dev`. Events show up in the `wrangler dev` log as `POST /events 204`.

### Turning telemetry on

Telemetry is built in only when `WXT_TELEMETRY_ENABLED=1` is set at build time (read through `import.meta.env` in `src/telemetry/consent.ts`). Without it, which is the default, the extension sends nothing and the settings panel has no **Privacy** section, so merging or releasing this code starts no collection. Set it (for example as an `env` entry on the build step of `publish.yml`) only once all of these are done:

- [ ] The Worker is deployed (secrets, or `npm run deploy` in `telemetry-worker/`). Until then heartbeats fail silently.
- [ ] A privacy policy page is published on logankuzyk.com.
- [ ] Usage data is declared in the Chrome Web Store and Edge Add-ons privacy practices, and the listings mention the setting.
