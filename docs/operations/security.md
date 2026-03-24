# Security & Auth

This document records the security-relevant behavior that actually exists today.

## Current Auth Model

`tgsm` authenticates as a Telegram user account through MTProto.

This means:

- it uses your real Telegram account, not the Bot API
- it requires `api_id` and `api_hash` from `my.telegram.org/apps`
- it stores a local MTProto session after login

## Current Local State

Per-account state is stored under:

```text
~/.tgsm/<account>/
```

Current files:

- `telegram.json`
- `mtcute-session`
- `cache.json`

Treat `mtcute-session` as highly sensitive. Anyone with that session can act as the authenticated Telegram account until the session is revoked.

## What Is Not Implemented

The following are not current product behavior and should not be assumed by operators or implementers:

- `config.toml`
- Effect-based rate-limiting layers
- local audit logs
- shipped delete/restore/trash workflows
- configurable credential loading via documented env vars

If those features are added later, they should be documented separately as implemented behavior rather than left implied.

## Current Safety Notes

- do not commit `~/.tgsm/` state into version control
- revoke the Telegram session from Telegram settings if a session file is exposed
- expect repeated full syncs to hit Telegram flood waits on large corpora; this is currently handled in the CLI but remains relevant operationally

## Operator Guidance

- verify which `tgsm` binary your shell resolves before assuming a global install is the one in use
- prefer `tgsm --debug sync` when diagnosing auth or sync behavior

For broader docs context, see [Docs Index](../README.md).
