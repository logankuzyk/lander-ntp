# Lander server

## Nightly database dumps

The server writes a compressed SQLite snapshot nightly at 03:17 UTC. It also makes a dump at
startup when the newest available dump is more than 24 hours old. Dumps older than 30 days are
removed. Set `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` together
to store dumps in Cloudflare R2. Without those values, the server uses `OBJECT_STORE_DIR`, which
defaults to `data/objects` for local runs. Set `HEARTBEAT_URL` to ping an external monitor after a
successful dump.

## Restore a database

1. Stop the server container so no process has the database open.
2. Keep a copy of the current database file if you may need to return to it.
3. On the mounted volume, run `npm run restore -- latest --to /path/on/the/volume/restored.sqlite`.
   Replace `latest` with a full object key such as `dumps/lander-20260131T031700Z.db.gz` to select
   a particular dump. The restore verifies SQLite integrity and removes every user recorded in
   `deleted-ids.json` before writing the destination.
4. To replace the configured live database path, pass that exact path and add `--replace`:
   `npm run restore -- latest --to /path/on/the/volume/lander.sqlite --replace`.
5. Start the server container and check `/health`.

The separate `deleted-ids.json` object is kept outside the database so deletion records survive
restoring an older dump. Entries contain only a random user id and its deletion time and are
pruned after 30 days.
