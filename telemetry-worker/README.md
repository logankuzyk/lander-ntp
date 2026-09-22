# Telemetry Worker

Takes usage events from the extension at `https://ntp.logankuzyk.com/events` and writes them to the Workers Analytics Engine dataset `lander_ntp_events`. The extension side is in [`src/telemetry`](../src/telemetry).

It never stores or logs client IPs, `request.cf` or headers. `CF-Connecting-IP` is used only as a rate-limiter key (30 requests a minute per IP, and per install id), and Workers Logs invocation logs are turned off in `wrangler.jsonc` because they would record each request's metadata. The code logs nothing about requests.

## Development

```bash
npm install
npm run dev        # wrangler dev on http://localhost:8787
npm test
npm run typecheck  # regenerates worker-configuration.d.ts from wrangler.jsonc first
```

To send events from a dev build of the extension, add this to the root `.env.local`:

```bash
WXT_TELEMETRY_URL=http://localhost:8787/events
WXT_TELEMETRY_ENABLED=1
WXT_TELEMETRY_DEV=1
```

## Deploying

`npm run deploy`, or push to `main`: [deploy-worker.yml](../.github/workflows/deploy-worker.yml) deploys once the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets are set. Create the token from the _Edit Cloudflare Workers_ template, scoped to the `logankuzyk.com` zone; querying needs a separate token with _Account Analytics: Read_. The first deploy creates the `ntp.logankuzyk.com` custom domain and the dataset.

## Columns

Analytics Engine columns are positional. Add new ones at the end and never reorder them.

| Column    | Heartbeat                              |
| --------- | -------------------------------------- |
| `index1`  | install id (a random UUID per install) |
| `blob1`   | event (`heartbeat`)                    |
| `blob2`   | browser (`chrome`, `firefox`, `edge`)  |
| `blob3`   | extension version                      |
| `blob4`   | photo mode (`cycle`, `pinned`)         |
| `blob5`   | photo frequency                        |
| `blob6`   | font                                   |
| `double1` | dim (0/1)                              |
| `double2` | clock enabled (0/1)                    |
| `double3` | clock 12-hour (0/1)                    |
| `double4` | clock shows date (0/1)                 |
| `double5` | clock shows seconds (0/1)              |
| `double6` | tags being cycled (count)              |

## Queries

Run these through the [SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/):

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d "SELECT ..."
```

Daily active installs, by browser:

```sql
SELECT toStartOfDay(timestamp) AS day, blob2 AS browser, count(DISTINCT index1) AS installs
FROM lander_ntp_events
WHERE blob1 = 'heartbeat' AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day, browser
ORDER BY day
```

The most recent settings each install reported in the last week:

```sql
SELECT index1, argMax(blob5, timestamp) AS frequency, argMax(blob6, timestamp) AS font
FROM lander_ntp_events
WHERE blob1 = 'heartbeat' AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY index1
```
