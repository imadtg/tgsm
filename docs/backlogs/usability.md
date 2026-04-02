# Usability Backlog

This file tracks retrieval and CLI usability shortcomings that are real enough to preserve, but not yet sharp enough to become roadmap commitments or spec requirements.

## Current Findings

- plain text search is useful, but entity aliases and spelling variants still require manual retrying
- standalone transaction-like notes are retrievable, but there is no higher-level timeline or ledger view to connect related entries automatically
- chronology windows are often noisy for terse operational notes; some note classes need semantic neighbors instead of just nearby timestamps
- the CLI can surface candidate predecessor and successor notes, but it does not yet rank likely causal links between them
- there is no compact entity-centric command such as "show all notes involving one person/topic ordered by time with inferred state changes"
- CLI reliability itself is part of product usability: if `tgsm sync` hangs, stalls, or requires falling back to lower-level code paths, that is a first-class bug rather than an implementation detail
- freshness is too implicit right now: after a sync attempt, the CLI should make it obvious whether later reads are using newly refreshed data or stale cache state
- deletion and mutation flows will need especially careful UX, but retrieval usability still needs more iteration before those become the focus
- dialog scope may fit better as a generic filterable field than as a primary command noun across the whole CLI
- a canonical message selector such as `<saved_peer_id>:<message_id>` may be a better long-term contract than bare numeric IDs when cross-dialog ambiguity matters; text-mode parsing can stay lenient and default to `self`, while JSON should always emit the explicit dialog/peer id
- the new selector-based `messages get` surface still needs iteration on exact expansion names, defaults, and the right amount of thread detail to expose in text mode
- the current text formatter is compact and labeled, but it still needs iteration against real agent workflows to determine whether it is token-efficient enough compared with a more snapshot-like grammar
- field projection, schema discoverability, and pipe-friendly batch flows are still unresolved:
  - add `--fields` or similar projection
  - rely more deliberately on `--json` plus `jq`
  - accept stdin or file-fed message IDs for bulk retrieval/context expansion
- e2e retrieval tasks should be tested against real "search then expand many hits" workflows, not only single-message inspection

## Rule

If a finding graduates into a product commitment, move it into:

- [Roadmap](../../ROADMAP.md) if it affects near-term scope
- [Product Spec](../spec/product.md) if it changes the contract
- [Output Contract](../spec/output-contract.md) if it changes the CLI surface
- [Operations Backlog](./operations.md) if it is primarily an implementation or operator gap
