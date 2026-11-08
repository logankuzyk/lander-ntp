# Triage Labels

The skills speak in terms of five canonical triage roles. This repo tracks them as the `Triage` select property on the Lander roadmap Notion database (see `issue-tracker.md`), using the canonical names as-is.

| Canonical role    | Value of `Triage` | Meaning                                  |
| ----------------- | ----------------- | ---------------------------------------- |
| `needs-triage`    | `needs-triage`    | Maintainer needs to evaluate this issue  |
| `needs-info`      | `needs-info`      | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an AFK agent  |
| `ready-for-human` | `ready-for-human` | Requires human implementation            |
| `wontfix`         | `wontfix`         | Will not be actioned                     |

The two category roles (`bug` / `enhancement`) map the same way, onto the separate `Category` select property.

Both properties were added to the Lander roadmap data source by `/setup-matt-pocock-skills` on 2026-11-07, since the database previously had no triage fields (only `Status` and `Type`, which serve the wayfinder hierarchy).
