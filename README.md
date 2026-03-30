# tgsm

`tgsm` is a retrieval-first CLI for navigating Telegram Saved Messages as structured, agent-readable context.

The documentation index and authority map live in [docs/README.md](docs/README.md).

It is built for two modes of use:

- real Telegram access through MTProto
- fixture-backed local testing for development and agent workflows

The first public release focuses on read paths only: sync, saved dialogs, message listing, context reconstruction, and thread inspection.

## Features

- Sync Saved Messages into a local cache
- Treat Saved Messages as dialog-aware, not only as a flat self-chat
- List saved dialogs and messages
- Inspect a message with:
  - nearby chronology
  - direct reply parent
  - direct backreplies
  - thread depth hints
- Inspect a thread tree
- Emit compact text by default, or exact JSON with `--json`
- Run against fixture snapshots for testing

## Install

### bun

```bash
bun add -g @imadtg/tgsm
```

### npm

```bash
npm install -g @imadtg/tgsm
```

### pnpm

```bash
pnpm add -g @imadtg/tgsm
```

## Requirements

- Bun, npm, or pnpm for installation
- A Telegram `api_id` and `api_hash` from <https://my.telegram.org/apps> for real Telegram usage

The published `@imadtg/tgsm` package is a launcher package that resolves a platform-specific standalone binary at runtime.

## Quick Start

### 1. Log in to Telegram

```bash
tgsm auth login
```

This prompts for:

- API ID
- API Hash
- Phone number
- Login code
- Optional 2FA password

### 2. Sync your Saved Messages

```bash
tgsm sync
```

### 3. Explore

```bash
tgsm saved-dialogs list
tgsm messages list
tgsm messages get 42
tgsm messages context 42
tgsm threads inspect 42
```

### 4. Use JSON mode when needed

```bash
tgsm messages list --json
tgsm messages get 42 --json
```

## Commands

### Auth

```bash
tgsm auth login
tgsm auth status
```

### Read Model

```bash
tgsm sync
tgsm saved-dialogs list
tgsm messages list [--dialog <saved_peer_id>] [--search <query>] [--limit <n>] [--cursor <cursor>]
tgsm messages get <id> [--dialog <saved_peer_id>]
tgsm messages context <id> [--dialog <saved_peer_id>]
tgsm threads inspect <id> [--dialog <saved_peer_id>]
```

### Global Flags

```bash
--json
--debug
--backend <telegram|fixture>
--fixture <path>
--home <path>
--account <name>
```

Version flags:

```bash
tgsm --version
tgsm -V
```

## Fixture Backend

The fixture backend is useful for tests, local prototyping, and agent workflows that should not hit Telegram.

```bash
tgsm --backend fixture --fixture ./sample.json sync
tgsm --backend fixture --fixture ./sample.json messages get 2 --dialog self
```

Example fixture shape:

```json
{
  "account": {
    "id": "fixture-account",
    "display_name": "Fixture Account"
  },
  "dialogs": [],
  "messages": []
}
```

See [packages/core/test/fixtures/sample-saved-messages.json](packages/core/test/fixtures/sample-saved-messages.json) for a complete example.

## Storage

By default, `tgsm` stores account state under:

```text
~/.tgsm/<account>/
```

Current files include:

- `cache.json`
- `telegram.json`
- `mtcute-session`

`mtcute-session` is a persisted Telegram session string, not a SQLite database.

Override the base path with:

```bash
tgsm --home /custom/path ...
```

## Release Model

This repo uses:

- Conventional Commits for commit hygiene
- Changesets for versioning and publishing

Changesets, not commit messages alone, are the source of truth for future version bumps.

Published package:

```text
@imadtg/tgsm
```

Platform binary packages:

```text
@imadtg/tgsm-linux-x64
@imadtg/tgsm-linux-arm64
@imadtg/tgsm-darwin-x64
@imadtg/tgsm-darwin-arm64
@imadtg/tgsm-windows-x64
@imadtg/tgsm-windows-arm64
```

For repo internals, operations, backlogs, and proposals, start with [docs/README.md](docs/README.md).

## Development

Install dependencies:

```bash
bun install
```

For the full multi-platform binary build, use Bun 1.3.11 or newer.

Run tests:

```bash
bun test
```

Typecheck:

```bash
bunx tsc --noEmit
```

Run the CLI from source:

```bash
bun run packages/cli/src/index.ts --help
```

## Operational Notes

- Prefer Bun for workspace install, test, build, and release work.
- Prefer `bun add -g @imadtg/tgsm` for the published global CLI.
- `npm install -g @imadtg/tgsm` and `pnpm add -g @imadtg/tgsm` are first-class supported.
- The launcher resolves the matching platform package at runtime. If installation is partial or the platform is unsupported, `tgsm` exits with a descriptive error.
- If you have multiple global package managers on the same machine, verify which binary your shell resolves:

```bash
which tgsm
tgsm --version
```

- For sync debugging or live operational tracing, use:

```bash
tgsm --debug sync
```

## Status

Implemented in the first public pass:

- auth
- sync
- saved-dialog listing
- message listing
- message context retrieval
- thread inspection
- fixture backend
- tests for core and CLI

Not yet implemented:

- soft delete / trash
- SQLite/FTS cache
- richer config
- exports
- semantic features
- bot/web UI

Tracked gaps and deferred findings live under [BACKLOG.md](BACKLOG.md) and [docs/backlogs/](docs/backlogs/README.md).

## License

MIT
