# Telegram Capabilities Research

This document records externally observed Telegram and library capabilities that matter to `tgsm`. It is research, not the product spec.

## What Looks Solid

- `tgsm` needs MTProto rather than the Bot API for reading a user's Saved Messages.
- Saved Messages is not only a flat self-chat. Telegram documents:
  - saved dialogs grouped by original source
  - dedicated saved-history and saved-search methods
  - reaction-based Saved Message tags for Premium users
- A read model that only assumes `inputPeerSelf` will miss forwarded or bookmarked material that Telegram surfaces as separate saved dialogs.

## Implications For tgsm

- The read model should treat Saved Messages as a container of dialogs, not just a single chronological stream.
- The CLI should expose dialog-aware navigation even if the first human-facing examples focus on self-authored notes.
- Future metadata work must compare three channels before committing:
  - native Saved Message tags
  - edited message suffixes
  - no in-band metadata

## TypeScript Library Landscape

### Leading Candidate: `mtcute`

Why it remains the best current fit:

- first-class TypeScript ergonomics
- runtime variants for Node and Bun
- direct support for Telegram account auth flows
- enough message primitives to build local indexes for replies, backreplies, and context bundles

What `mtcute` appears to give directly:

- account sign-in and session persistence
- message fetch and iteration primitives
- message deletion/edit APIs
- access to reply/media/forward metadata

What `tgsm` still needs to build locally:

- reverse reply indexes
- bounded context windows
- dialog-aware read abstractions
- stable agent-facing output envelopes
- optional safety layers for mutation workflows

### Alternatives Worth Keeping In Mind

- `gramjs`: mature and known, but less appealing as a TypeScript-first baseline.
- `@mtproto/core`: lower-level escape hatch if higher-level libraries block a needed Saved Messages feature.
- `teleproto` and `tgsnake`: worth monitoring, but not yet strong enough to replace `mtcute` as the default assumption.

## Open Research Notes

- It is still worth verifying which Saved Message dialog features are fully exposed in the chosen library, versus requiring lower-level API calls.
- It is also worth verifying whether native Saved Message tags are realistically usable for non-Premium or mixed-account scenarios before building around them.
- If in-band metadata edits are ever adopted, they need their own safety and reversibility research rather than piggybacking on read-model assumptions.

## Sources

- Telegram API: Saved Messages
  - https://core.telegram.org/api/saved-messages
- Telegram API: Obtaining `api_id`
  - https://core.telegram.org/api/obtaining_api_id
- mtcute docs
  - https://mtcute.dev/
- Hypothesis
  - Library coverage of every Saved Messages edge case may still require direct validation against real account data during implementation.
