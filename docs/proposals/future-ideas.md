# Future Ideas

This file keeps the larger vision intact without letting it bloat the sharp basis. Nothing here is committed product scope. These are proposals, research prompts, and longer-horizon directions worth revisiting after the retrieval and read-model foundation is solid.

## Why This Exists

`tgsm` started from a real backlog problem, but the surrounding ideas are richer than the first implementation should absorb. This document preserves those ideas with enough context that they can be resumed later without re-deriving the motivation.

## 1. A Better Human Client

The near-term plan is CLI-first, possibly with a thin review surface. The larger idea is a better human interface for Saved Messages:

- stronger thread navigation than Telegram offers today
- visible backreplies
- better context injection around rapid-fire note bursts
- bulk review flows for triage and deletion
- richer topic or queue views than Telegram's flat chronology

This can start as a lightweight review UI and later grow into a serious alternate client if the core model proves strong enough.

Why deferred:

- the core value is in the read model and output contract
- a client built before the model stabilizes will likely calcify the wrong abstractions

## 2. In-Band Metadata And Reordering

There is clear interest in eventually storing some review state in Telegram itself instead of in local product metadata. The two most important directions are:

- native Telegram Saved Message tags
- edited message suffixes that append machine-readable markers to your own notes

Potential use cases:

- triage status
- priority queues
- reorderable review backlogs
- tags or topical grouping
- lightweight preservation markers

Why deferred:

- even append-only edits can damage trust if rollback guarantees are weak
- Telegram-native tags may cover part of the need with far less risk
- the project should first prove it can read and reason over the corpus safely

## 3. Semantic And Learned Views

There is a strong longer-term pull toward a smarter index that can learn your habits and surface better summaries or discovery paths.

Ideas worth retaining:

- semantic search over the backlog
- topic clustering
- backlog summaries that agents can elaborate on demand
- entity extraction and concept graphs
- suggestions for cross-thread links
- stale-note and duplicate-note detection

Why deferred:

- the sharp basis does not require vectors or embeddings
- these features are only useful once the foundational read model is stable and trusted

## 4. Export And Migration Intelligence

`tgsm` may eventually help move material out of Telegram into a more durable knowledge system.

Possible directions:

- Obsidian export
- Logseq export
- richer Markdown export
- link notebooks
- agent-assisted extraction into permanent notes
- a future Obsidian or Logseq plugin

Why deferred:

- the first problem is understanding what is already in Telegram
- export targets should follow clear user workflows, not precede them

## 5. Review And Notification Surfaces

If deletion or other review-oriented operations arrive later, several surfaces are plausible:

- CLI review flows
- Telegram bot review
- lightweight web review
- terminal UI
- push notification routing via tools like `ntfy` or Apprise

Why deferred:

- these surfaces all depend on the same operational core
- there is no reason to commit to one before the mutation proposal graduates

## 6. Domain-Specific Views

Some use cases are important but should not define the general product yet.

Examples:

- money lent/borrowed tracking
- specialized content review for links, videos, or media drops
- capture pipelines for a specific personal workflow

These are useful as motivating examples, but they should remain downstream of a small, general, agent-usable core.

## 7. Alternate Interfaces

The project may eventually expose the same model through more than a CLI:

- richer local app
- bot companion
- web review UI
- MCP or other agent-integration layers

Why deferred:

- the CLI keeps the scope sharp
- other interfaces should be consumers of the same model, not independent design centers

## 8. Research Prompts To Revisit Later

- compare native Telegram tags against edited suffix metadata for real triage workflows
- evaluate whether compact text or JSON works better across multiple agent families
- explore whether some saved-dialog groupings deserve first-class specialized views
- test whether semantic summarization is useful enough to justify a local model or vector store
- revisit alternate-client UX once the read model has been used in practice
