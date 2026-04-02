# tgsm

`tgsm` is a retrieval-first CLI for navigating Telegram Saved Messages as structured, agent-readable context.

The documentation index and authority map live in [docs/README.md](docs/README.md).

It is built for two modes of use:

- real Telegram access through MTProto
- fixture-backed local testing for development and agent workflows

The current read surface focuses on sync, message listing, selector-based retrieval, and optional expansion of chronology, reply/backreply, and thread structure.

## Features

- Sync Saved Messages into a local cache
- Treat Saved Messages as dialog-aware, not only as a flat self-chat
- List messages
- Inspect one message by selector or bare self-defaulting ID
- Expand a retrieval with optional:
  - nearby chronology
  - direct reply parent
  - direct backreplies
  - bounded thread structure
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
tgsm messages list
tgsm messages get 42
tgsm messages get 42 --with chronology --with reply_parent --with backreplies
tgsm messages get self:42 --with thread --thread-depth 2
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
tgsm messages list [--dialog <saved_peer_id>] [--search <query>] [--limit <n>] [--cursor <cursor>]
tgsm messages get <selector> [--with <chronology|reply_parent|backreplies|thread|all>] [--before <n>] [--after <n>] [--thread-depth <n>]
```

Selectors:

- bare numeric IDs default to `self:<message_id>` when possible
- explicit selectors use `<saved_peer_id>:<message_id>`, for example `self:42` or `channel:2167875895:36649`

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

Or by setting:

```bash
export TGSM_HOME=/custom/path
```

## Release Model

This repo uses:

- Conventional Commits for commit hygiene
- Changesets for versioning and publishing

Changesets, not commit messages alone, are the source of truth for future version bumps.

The currently validated release path in this repo is:

1. add a Changeset
2. run `bunx changeset version`
3. commit and push the versioned package state to `main`
4. let the release workflow publish from that pushed state

Do not assume Actions-created release PRs are the primary path here.

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

Implemented in the current pass:

- auth
- sync
- message listing
- selector-based message retrieval
- optional chronology/reply/backreply/thread expansion
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
