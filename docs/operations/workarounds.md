# Workarounds

This document records workarounds that proved useful on one real development machine.

These are not normative repo behavior. Use them only when the higher-level operational guidance in [Operations](./README.md) is not enough.

## Scope

This file is intentionally machine-specific and tactical.

## Workarounds That Helped On This Machine

### Global Binary Resolution

Observed issue:

- plain `tgsm` resolved to a `mise` shim instead of the Bun global binary

What helped on this machine:

- checking `which tgsm`
- checking `tgsm --version`
- verifying the Bun-installed binary directly at:

```bash
~/.cache/.bun/bin/tgsm --version
```

### Bun Publish Authentication

Observed issue:

- `bun publish` initially reported missing authentication even though npm auth appeared valid

What helped on this machine:

- verifying auth with `bunx npm whoami`
- explicitly passing the npm token to Bun through `NPM_CONFIG_TOKEN` during publish

### Live Sync Diagnosis

Observed issue:

- repeated syncs could look hung when Telegram flood waits were actually being handled

What helped on this machine:

- running:

```bash
tgsm --debug sync
```

- reading `stderr` for flood-wait and cleanup events before assuming the process was dead

## Rule

If a workaround here becomes common, stable, and repo-relevant, move the principle into [Operations](./README.md) and keep only the machine-local detail here.
