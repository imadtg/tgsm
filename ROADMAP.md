# ROADMAP

`tgsm` is a retrieval-first CLI with an internal core library for navigating Telegram Saved Messages as an agent-readable knowledge substrate.

The sharp basis is not "Telegram automation" in general. It is a compact, dependable read model that lets agents and humans inspect saved dialogs, search messages, reconstruct local context, and traverse reply/backreply structure without guessing how Telegram's UI happens to hide or reveal that information.

## What V1 Proves

- Saved Messages can be modeled as a set of saved dialogs, not only a flat self-chat.
- A local cache can index Telegram data without becoming a second source of truth.
- Agents can work effectively with compact default text output and an explicit `--json` mode.
- Context can be made first-class:
  - chronological neighborhood
  - first-degree reply ancestry
  - first-degree backreplies
  - deeper-thread summaries
- Backlog triage becomes practical once retrieval is sharp, even before richer mutation flows exist.

## Sharp Basis

- Retrieval and navigation over all saved dialogs
- Search and filtering across the cached corpus
- Canonical context bundles for `messages get` and `messages context`
- Thread inspection derived from reply edges
- Compact agent-friendly default output with `--json` as a strict mode
- Local cache, indexes, and operational state only

## Explicitly Deferred

- Rich Telegram mutations beyond sync
- Soft-delete as a core roadmap phase
- In-band metadata edits
- Semantic/vector indexing
- Translation and summarization pipelines
- Bot, web, and MCP interfaces
- Domain-specific views such as debt extraction
- Full alternate Telegram client

These are preserved as research or proposals, not roadmap commitments.

## Near-Term Public Surface

- `tgsm sync`
- `tgsm saved-dialogs list`
- `tgsm messages list`
- `tgsm messages get <id>`
- `tgsm messages context <id>`
- `tgsm threads inspect <id>`
- `tgsm ... --json`

The authoritative command and type contracts live in:

- [Product Spec](docs/spec/product.md)
- [Read Model Spec](docs/spec/read-model.md)
- [Output Contract](docs/spec/output-contract.md)
- [Architecture Boundaries](docs/spec/architecture-boundaries.md)
- [Docs Index](docs/README.md)

## Deferred But Tracked

- [Soft Delete Proposal](docs/proposals/soft-delete.md)
- [Open Decisions](docs/decisions/open-decisions.md)
- [Backlogs](docs/backlogs/README.md)
- [Future Ideas](docs/proposals/future-ideas.md)

## Research Appendices

- [Telegram Capabilities](docs/research/telegram-capabilities.md)
- [Agent CLI Patterns](docs/research/agent-cli-patterns.md)
- [Tooling And Packaging](docs/operations/tooling-and-packaging.md)

## Why This Shape

The previous roadmap mixed product definition, implementation choices, and speculative future packages. The rewritten structure keeps the main handoff compact:

- spec docs say what must be true
- research docs say what informed the choices
- proposal docs say what may come later

Another engineer should be able to understand the product by reading this file, [Product Spec](docs/spec/product.md), and [Docs Index](docs/README.md) first, then dive only where needed.
