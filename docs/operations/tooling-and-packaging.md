# Tooling And Packaging

This document records the current implementation baseline for tooling, packaging, and release work.

It is an implementation reference, not an options survey. If a choice changes later, update this file to reflect the new implementation and move speculative alternatives into backlog, proposal, or research docs.

## Current Stack

- workspace/package manager: Bun workspaces
- Telegram client library: `mtcute`
- CLI framework: `commander`
- build tooling:
  - `tsup` for the internal source CLI packages
  - `bun build --compile` for the published platform binaries
- typecheck: `tsc`
- test runner: Bun test
- versioning intent: Changesets
- commit hygiene: Conventional Commits
- published package family:
  - `@imadtg/tgsm`
  - `@imadtg/tgsm-linux-x64`
  - `@imadtg/tgsm-linux-arm64`
  - `@imadtg/tgsm-darwin-x64`
  - `@imadtg/tgsm-darwin-arm64`
  - `@imadtg/tgsm-windows-x64`
  - `@imadtg/tgsm-windows-arm64`

## Workspace Shape

Current packages:

- `packages/core`
- `packages/cli`
- `packages/npm-wrapper`
- `packages/tgsm-linux-x64`
- `packages/tgsm-linux-arm64`
- `packages/tgsm-darwin-x64`
- `packages/tgsm-darwin-arm64`
- `packages/tgsm-windows-x64`
- `packages/tgsm-windows-arm64`

The repo is intentionally minimal at this stage. Bot/web consumers remain future work, not active packages.

## Release Shape

Current release target:

- publish the six platform packages
- publish `packages/npm-wrapper` as `@imadtg/tgsm`

Current release support:

- CI in GitHub Actions
- Release workflow in GitHub Actions
- local validation flow for pack/smoke checks

## Why These Choices Were Kept

### Bun

Bun is the current default because it is the workspace, install, test, and binary compile tool that is used to build and release the repo.

### mtcute

`mtcute` is the current MTProto client because it supports the account-auth and Saved Messages access patterns this CLI needs.

### commander

`commander` is the current CLI framework because it is already implemented in the internal source CLI package and compiles cleanly into the published standalone binaries.

### Changesets

Changesets is the current versioning flow because it supports explicit release intent and works cleanly with the current workspace.

## What Is Still Not Settled As Product Direction

These are implementation details today, not product guarantees:

- future database/cache engine
- future mutation policy framework
- future bot/web package layout
- future semantic or export infrastructure

Those should only move back into mainline docs once they are implemented and hardened.
