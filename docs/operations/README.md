# Operations

This document describes the current operational behavior of the repo and CLI at a high level.

For machine-local quirks, see [Workarounds](./workarounds.md).
For unimplemented operational ideas, see [Operations Backlog](../backlogs/operations.md).

## Current Stack

Current implementation:

- package manager and workspace tooling: Bun
- Telegram client library: `mtcute`
- CLI framework: `commander`
- versioning and release intent: Changesets
- commit hygiene: Conventional Commits
- published wrapper package: `@imadtg/tgsm`

## Repo Shape

Near-term packages:

- `packages/core`
- `packages/cli`
- `packages/npm-wrapper`
- `packages/tgsm-linux-x64`
- `packages/tgsm-linux-arm64`
- `packages/tgsm-darwin-x64`
- `packages/tgsm-darwin-arm64`
- `packages/tgsm-windows-x64`
- `packages/tgsm-windows-arm64`

The release target today is a wrapper package plus per-platform binary packages.

## Local Development

Install dependencies:

```bash
bun install
```

Typecheck:

```bash
bun run typecheck
```

Run tests:

```bash
bun test
```

Build packages:

```bash
bun run build
```

For the full six-target binary build, use Bun 1.3.1 or newer.

Run the CLI from source:

```bash
bun run packages/cli/src/index.ts --help
```

## Testing Strategy

The repo uses two complementary testing modes.

Automated:

- fixture-backed tests for read-model behavior
- fixture-backed CLI tests for output and command behavior

Live/manual:

- real Telegram account login and sync validation
- repeated sync hammering to validate flood-wait and cleanup behavior
- real read-path validation against actual Saved Messages data

The production-critical live commands validated so far are:

- `tgsm auth login`
- `tgsm auth status`
- `tgsm sync`
- `tgsm saved-dialogs list`
- `tgsm messages list`
- `tgsm messages get <id>`
- `tgsm threads inspect <id>`

`messages context` exists and is implemented, but it has not been stressed to the same level as the commands above.

## Debugging

The main operational debug path is:

```bash
tgsm --debug sync
```

`--debug` writes diagnostics to `stderr`, including:

- connection state changes
- flood waits
- saved-history pagination
- sync failures
- cleanup status

## Sync Behavior

`tgsm sync` currently performs a full refresh into the local JSON cache.

Current implications:

- sync time is bounded but not always short
- repeated syncs against a large corpus can legitimately hit Telegram flood waits
- successful syncs may therefore take noticeably longer under repeated use

That is current behavior, not necessarily a defect.

## Local State

Per-account state currently lives under:

```text
~/.tgsm/<account>/
```

Current files:

- `cache.json`
- `telegram.json`
- `mtcute-session`

## Release Flow

The intended release model is:

- use Changesets to declare the version bump
- validate locally with install, typecheck, tests, and build
- publish the platform packages first
- publish the wrapper package last
- push the corresponding git state

High-level local release sequence:

1. add a Changeset
2. version packages
3. refresh/install workspace dependencies
4. run typecheck
5. run tests
6. run build
7. publish the platform packages and wrapper package

Machine-local publishing quirks, if any, belong in [Workarounds](./workarounds.md), not here.

## Installation And Resolution

Bun is the preferred workspace tool for development, testing, and release work.

For the published global CLI, the preferred install path is `bun add -g @imadtg/tgsm`.

The generic `@imadtg/tgsm` package is now a launcher that resolves one of the platform packages:

- `@imadtg/tgsm-linux-x64`
- `@imadtg/tgsm-linux-arm64`
- `@imadtg/tgsm-darwin-x64`
- `@imadtg/tgsm-darwin-arm64`
- `@imadtg/tgsm-windows-x64`
- `@imadtg/tgsm-windows-arm64`

This keeps the platform-specific standalone executable out of the generic wrapper package and removes the old native Node addon ABI mismatch from the end-user wrapper install path.

Operationally, what matters is that the shell resolves the expected binary and version. Another team should verify that as part of any install or release check rather than assuming one global package manager owns the command name.

## Related Docs

- [Security & Auth](./security.md)
- [Tooling And Packaging](./tooling-and-packaging.md)
- [Workarounds](./workarounds.md)
- [Docs Index](../README.md)
