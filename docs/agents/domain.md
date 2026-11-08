# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root for the glossary.
- **Decisions**, in place of ADRs: `Type: grilling` rows in the **Lander roadmap** Notion database (see `docs/agents/issue-tracker.md`). A closed one carries a `## Resolution` section with the decision and the owner's reasoning; a still-open one is a question in progress. Query the data source (`notion-query-data-sources`, filtered on `Type: grilling`) for rows that touch the area you're about to work in, and fetch each one's page for its Resolution.

There is no `docs/adr/` in this repo — decisions live in Notion, not as files. Don't create one. If `CONTEXT.md` doesn't exist, proceed silently: the `/domain-modeling` skill creates it lazily when terms actually get resolved.

## File structure

Single-context repo (this repo):

```
/
├── CONTEXT.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag decision conflicts

If your output contradicts the Resolution of a closed `grilling` ticket, surface it explicitly rather than silently overriding:

> _Contradicts LR-9's Resolution ("The standard widget pattern"), but worth reopening because…_
