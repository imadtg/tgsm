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

## Rule

If a finding graduates into a product commitment, move it into:

- [Roadmap](../../ROADMAP.md) if it affects near-term scope
- [Product Spec](../spec/product.md) if it changes the contract
- [Output Contract](../spec/output-contract.md) if it changes the CLI surface
- [Operations Backlog](./operations.md) if it is primarily an implementation or operator gap
