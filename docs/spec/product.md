# Product Spec

## Product Statement

`tgsm` is a retrieval-first CLI and library for navigating Telegram Saved Messages as structured, agent-readable context.

It exists to make a large Saved Messages backlog workable for agents and humans by exposing message neighborhoods, reply/backreply structure, and saved-dialog scope more clearly than Telegram's UI.

## Primary Audience

- Shell-native agents that can call CLI tools and parse compact text or JSON
- Humans using the terminal to inspect, search, and triage a Saved Messages backlog

## Core Jobs To Be Done

- Find messages or clusters of messages relevant to a topic
- Reconstruct the local context around a message without manually scrolling Telegram
- Traverse explicit reply chains and reverse reply edges
- Triage backlog items that are disconnected, weakly connected, or poorly surfaced by Telegram itself
- Inspect forwarded/bookmarked content alongside self-authored notes

## Non-Goals For The Sharp Basis

- Broad Telegram automation
- Full CRUD abstractions for Telegram messages
- Replacing Telegram as the durable source of truth
- Building a semantic knowledge base on day one
- Building a full alternate Telegram client in the near term
- Solving domain-specific workflows such as debt/accounting extraction

## Source Of Truth Model

- Telegram is the source of truth for message content and message existence.
- `tgsm` may maintain local cache, indexes, and operational safety state.
- The cache must not become the canonical location for durable user meaning.
- Durable local metadata beyond what is required for cache/index/recovery is intentionally minimized in the sharp basis.

## Scope Boundaries

### In Scope

- Reading and indexing Saved Messages across all saved dialogs
- Exposing a canonical read model for messages, dialogs, and threads
- Context bundles that combine chronology and reply structure
- Search and filtering over the local cache
- Compact default output plus `--json`
- A follow-on soft-delete proposal, clearly separated from the sharp basis

### Out Of Scope

- Bot/web/MCP consumers as roadmap commitments
- Embeddings, clustering, summarization, or translation as required features
- Rich local annotations
- Automatic in-band metadata editing
- Export-first workflows

## Near-Term Success Criteria

- Another engineer can implement the read model without guessing what "context" means.
- An agent can inspect one message and receive enough adjacent context to decide whether to crawl further.
- A human can list saved dialogs and understand that Saved Messages is broader than the self-authored stream.
- The CLI surface is small, predictable, and discoverable.
- The roadmap remains focused on the read model and does not sprawl into speculative packages.

## Why Not Yet

### Soft Delete

Soft-delete is a valid mutation proposal because the project wants DI and safety layers around destructive operations. It is not part of the sharp basis because the core retrieval model must be trusted first.

### In-Band Metadata Edits

Edited suffix markers are user-interesting, but they create correctness, UX, and rollback concerns. They remain a future proposal after the read model and mutation safety baseline exist.

### Rich Knowledge Workflows

Summaries, semantic search, migrations, and alternative clients are compelling, but they should consume the same stable read model rather than define it prematurely.

## Linked Specs

- [Read Model Spec](./read-model.md)
- [Output Contract](./output-contract.md)
- [Architecture Boundaries](./architecture-boundaries.md)
- [Soft-Delete Proposal](./mutations-soft-delete.md)
