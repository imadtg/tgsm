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

## mtcute Integration Follow-Ups

These came out of a docs-guided audit against mtcute's `llms.txt` and guide pages.
They are not current behavior.

- disable mtcute updates for the request/response CLI client paths that do not consume updates
- replace `client.start({})` in non-login flows with explicit signed-in checks and manual auth-state handling
- preserve RPC error detail instead of flattening auth loss, transport failure, and flood/rate-limit cases into generic errors
- remove the dead `hash = 0` not-modified branch or implement a real incremental sync hash flow
- paginate `messages.getSavedDialogs` instead of assuming a single page is enough
- avoid persisting Telegram credentials before a successful login completes
- tighten local secret-storage handling and file-ignore coverage for `mtcute-session` SQLite sidecar files
- document the actual mtcute storage behavior, including possible `-wal` and `-shm` files
- consider session export/import support for containerized or ephemeral environments

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

## Rule

If an item here becomes implemented and tested, move it into:

- [Operations](../operations/README.md) if it is current operational behavior
- [Security & Auth](../operations/security.md) if it changes security-relevant behavior
- [README](../../README.md) if users need it immediately
