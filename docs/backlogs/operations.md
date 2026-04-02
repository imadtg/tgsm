# Operations Backlog

This file tracks operational and dev-experience work that is not implemented yet.

These items should not be described as current behavior elsewhere in the docs.

## Current Gaps

- first-class `tgsm auth logout`
- stronger install ergonomics across mixed global package managers
- field projection support such as `--fields`
- incremental sync instead of full-refresh sync
- SQLite/FTS-backed local cache
- explicit cache freshness and staleness UX
- documented and implemented config file for operator settings
- documented and implemented environment-variable credential loading
- mutation audit logging if delete/restore flows are ever implemented
- stronger multi-account operational guidance
- media handling is still shallow: the cache keeps only a coarse `media_summary`, with no durable media reference model and no lazy download-to-cache path for agents

## mtcute Integration Follow-Ups

These came out of a docs-guided audit against mtcute's `llms.txt` and guide pages.
They are not current behavior.

- replace `client.start({})` in non-login flows with explicit signed-in checks and manual auth-state handling
- remove the dead `hash = 0` not-modified branch or implement a real incremental sync hash flow
- paginate `messages.getSavedDialogs` instead of assuming a single page is enough
- map important mtcute RPC/auth errors into sharper operator-facing `tgsm` errors instead of flattening them into generic failures
- evaluate first-class session import/export commands on top of mtcute string sessions and session-conversion support
- revisit `@mtcute/bun` only when it is stable enough for production use and the repo has a stronger live and compiled-binary regression suite to validate a migration safely
- keep `BaseTelegramClient` in mind as a later bundle/startup optimization path if the current `TelegramClient` surface becomes too heavy for the compiled CLI

## Mutation-Adjacent Operational Work

These remain proposals until the mutation surface exists:

- delete/restore/trash operational playbooks
- safety caps and mutation rate limiting
- recovery window review tooling
- mutation audit logs

## Packaging And Release Follow-Ups

- make Bun publish authentication behavior fully reproducible without manual environment intervention
- improve install verification and binary-resolution checks across Bun, npm, and mixed shell setups
- consider automating a publish-artifact smoke test after release

## External Tooling And Precedent Follow-Ups

- review nearby Telegram CLI/client projects for reusable UX and test ideas, especially around auth flows, local cache models, and e2e validation fixtures
- preserve notable precedents that may inform tgsm, including `RandyVentures/tgcli`, `vysheng/tg`, `mtcute/mtcute`, `overtake/TelegramSwift`, and `telega.el`
- remember that Peter Steinberger (`steipete`) has starred `RandyVentures/tgcli`, which makes it a useful precedent to inspect deliberately rather than casually
- also review adjacent non-Telegram tools for saved-message, notes, backlog, or read-later workflows if they suggest better retrieval UX or better e2e test fixtures

## Rule

If an item here becomes implemented and tested, move it into:

- [Operations](../operations/README.md) if it is current operational behavior
- [Security & Auth](../operations/security.md) if it changes security-relevant behavior
- [README](../../README.md) if users need it immediately
