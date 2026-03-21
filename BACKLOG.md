# BACKLOG

The old free-form backlog has been split so the top-level docs stay compact.

Use these instead:

- [Future Ideas](docs/proposals/future-ideas.md) for out-of-scope product directions and ramblings worth preserving
- [Open Decisions](docs/open-decisions.md) for high-leverage unresolved choices
- [Research Appendices](docs/research/telegram-capabilities.md) for evidence and option space

If a topic is not part of the sharp basis, it should usually live under `docs/proposals/` or `docs/research/`, not in the roadmap.

## Usability Findings

Generic shortcomings observed during live retrieval probes:

- plain text search is useful, but entity aliases and spelling variants still require manual retrying
- standalone transaction-like notes are retrievable, but there is no higher-level timeline or ledger view to connect related entries automatically
- chronology windows are often noisy for terse operational notes; some note classes need semantic neighbors instead of just nearby timestamps
- the CLI can surface candidate predecessor and successor notes, but it does not yet rank likely causal links between them
- there is no compact entity-centric command such as "show all notes involving one person/topic ordered by time with inferred state changes"
- CLI reliability itself is part of product usability: if `tgsm sync` hangs, stalls, or requires falling back to lower-level code paths, that is a first-class bug rather than an implementation detail
- freshness is too implicit right now: after a sync attempt, the CLI should make it obvious whether later reads are using newly refreshed data or stale cache state
- deletion and mutation flows will need especially careful UX, but retrieval usability still needs more iteration before those become the focus
