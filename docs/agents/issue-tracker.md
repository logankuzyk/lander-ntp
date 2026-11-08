# Issue tracker: Notion (Lander roadmap)

Issues, feedback, and the widget roadmap live in one Notion database: **Lander roadmap** (https://app.notion.com/p/26b90669f1b54af2bcfa8a2fe201988f). Use the Notion MCP tools for all operations; there is no CLI.

Data source: `collection://b75cc68b-f3ca-4f28-bb11-5961b0b61d9f` — fetch it for the live schema (`notion-fetch`).

## Schema

| Property | Type | Values / notes |
| --- | --- | --- |
| `Name` | title | — |
| `userDefined:ID` | auto-increment number | the `#42`-style reference for this tracker |
| `Status` | select | `Open`, `In progress`, `Closed`, `Out of scope` |
| `Type` | select | `map`, `phase`, `research`, `prototype`, `grilling`, `task`, `build` — wayfinder's hierarchy levels, not a triage field |
| `Category` | select | `bug`, `enhancement` — the triage category role |
| `Triage` | select | `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` — the triage state role, added by `/setup-matt-pocock-skills` on 2026-11-07 |
| `Agent` | select | `Claude`, `Codex` — which coding agent builds it; only the orchestrator sets this |
| `Assignee` | person | — |
| `PR` | url | the GitHub PR implementing this item, once one exists |
| `Parent item` / `Sub-items` | relation | the map → phase → ticket hierarchy |
| `Blocked by` / `Blocking` | relation | dependency edges |

## Conventions

- **Resolve `#42`**: query the data source for `"userDefined:ID" = 42` (`notion-query-data-sources`, SQL or rows mode).
- **Create an issue/ticket**: `notion-create-pages` with parent = the data source, setting `Name`, `Category`, `Triage: needs-triage` (or whatever state applies), `Type: task` unless it's clearly a different wayfinder type.
- **Read an issue**: `notion-fetch` the page URL; use `include_discussions: true` to see triage/comment threads, then `notion-get-comments` for full text.
- **List issues in a bucket**: `notion-query-data-sources` filtered on `Triage` (e.g. `enum_is "needs-triage"`) or on `is_empty` for unlabeled rows.
- **Comment on an issue**: `notion-create-comment` on the page.
- **Apply / change triage state or category**: `notion-update-page`, setting the `Triage` and/or `Category` select property.
- **Close**: set `Status: Closed` (or `Out of scope` for a rejected enhancement) via `notion-update-page`.

## Pull requests as a triage surface

**PRs as a request surface: no.** This is a solo project (`logankuzyk/lander-ntp` on GitHub); Codex is a second coding agent working under the same owner, not an external contributor, so GitHub PRs aren't triaged as issues. Code review of PRs happens separately, as PR comments on GitHub.

## When a skill says "publish to the issue tracker"

Create a row in the Lander roadmap data source (above).

## When a skill says "fetch the relevant ticket"

`notion-fetch` the ticket's page URL (or resolve its `#id` first via the query above).

## Wayfinding operations

Used by `/wayfinder`. This is the database's native shape, not something bolted on for triage:

- **Map**: the single row with `Type: map`.
- **Phase**: a row with `Type: phase`, related to the map via `Parent item`.
- **Child ticket**: a row with `Type` one of `research`/`prototype`/`grilling`/`task`/`build`, related to its phase via `Parent item`. Once claimed, set `Assignee`.
- **Blocking**: the `Blocked by` / `Blocking` relation properties (two-way).
- **Frontier query**: rows that are `Status: Open`, have no `Assignee`, and whose every `Blocked by` row has `Status: Closed`. First in map order wins.
- **Claim**: set `Assignee` on the row (the session's first write).
- **Resolve**: comment the answer (`notion-create-comment`), set `Status: Closed`, then update the parent phase/map notes if the skill tracks decisions there.
