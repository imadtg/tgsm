# tgsm

`tgsm` is a retrieval-first CLI for navigating Telegram Saved Messages as structured, agent-readable context.

## Install

```bash
bun add -g @imadtg/tgsm
```

## Quick Start

```bash
tgsm auth login
tgsm sync
tgsm saved-dialogs list
tgsm messages list
tgsm messages get 42
tgsm messages get 42 --json
```

For sync debugging:

```bash
tgsm --debug sync
```

## Fixture Backend

```bash
tgsm --backend fixture --fixture ./sample.json sync
tgsm --backend fixture --fixture ./sample.json messages get 2 --dialog self
```

## Commands

```bash
tgsm auth login
tgsm auth status
tgsm sync
tgsm saved-dialogs list
tgsm messages list
tgsm messages get <id>
tgsm messages context <id>
tgsm threads inspect <id>
```

## Global Flags

```bash
--json
--debug
--backend <telegram|fixture>
--fixture <path>
--home <path>
--account <name>
```

## Version

```bash
tgsm --version
tgsm -V
```

## Docs

Repository, full guide, and docs map:

- <https://github.com/imadtg/tgsm>
