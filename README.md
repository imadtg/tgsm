# tgsm

`tgsm` is a retrieval-first CLI for navigating Telegram Saved Messages as structured, agent-readable context.

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

### npm

```bash
npm install -g @imadtg/tgsm
```

### bun

```bash
bun add -g @imadtg/tgsm
```

## Requirements

- Node.js 20+ recommended for the published npm package
- A Telegram `api_id` and `api_hash` from <https://my.telegram.org/apps> for real Telegram usage

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
--backend <telegram|fixture>
--fixture <path>
--home <path>
--account <name>
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

Override the base path with:

```bash
tgsm --home /custom/path ...
```

## Release Model

This repo uses:

- Conventional Commits for commit hygiene
- Changesets for versioning and publishing

The current package starts at:

```text
tgsm@0.0.1
```

Changesets, not commit messages alone, are the source of truth for future version bumps.

## Development

Install dependencies:

```bash
bun install
```

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

## License

MIT
