# Soft Delete Proposal

This document is a proposal for the first mutation surface in `tgsm`. It is not part of the sharp basis of the product. The read model, output contract, and sync model must be specified and accepted first.

## Status

- Stage: Proposal
- Priority: After the read model
- Purpose: Explore one safe mutation path without expanding `tgsm` into a general Telegram editing client

## Why This Exists

Deletion is the mutation with the clearest safety story for `tgsm`:

- the backlog likely contains disposable notes, link drops, and abandoned fragments
- agents can help identify deletion candidates
- deletion mistakes are costly, so a recovery model is mandatory

This is the first mutation proposal because it stress-tests the service boundaries, audit trail, and undo guarantees without forcing the project to solve arbitrary message editing up front.

## Non-Goals

- No general message editing
- No in-band metadata edits
- No reply authoring or message creation
- No bot, web, or TUI commitment in the sharp basis
- No assumption that deletion ships in the first implementation milestone

## Preconditions

The proposal stays dormant until all of the following exist:

1. The read model can return a stable `MessageContextBundle` for any target message.
2. The cache/index layer can reconstruct enough message state to support review and undo.
3. The output contract clearly distinguishes read-path visibility from queued-for-delete visibility.
4. Audit logging and backup semantics are specified.

## Reserved CLI Surface

These commands are reserved by the docs but are not part of the initial committed roadmap:

```bash
tgsm messages delete <id>
tgsm messages restore <id>
tgsm trash list
tgsm trash purge
tgsm trash status
```

All mutating commands must support `--dry-run` and `--json`.

## Default Proposal

The proposed deletion model is soft delete first, hard delete later.

1. A delete request never hits Telegram immediately.
2. The message is queued in a local trash table with a recovery deadline.
3. Read commands hide queued messages by default but can surface them explicitly.
4. The message can be restored before expiry.
5. Hard deletion only happens on explicit purge or on timeout if the chosen policy allows it.

## Suggested Data Model

The trash table is operational state, not durable product metadata. It exists only to make deletion safe.

```sql
CREATE TABLE trash_entries (
  id INTEGER PRIMARY KEY,
  message_id INTEGER NOT NULL,
  saved_peer_id TEXT NOT NULL,
  queued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL,      -- pending | restored | deleted | failed
  queued_by TEXT NOT NULL,   -- agent | human
  reason TEXT,
  snapshot_json TEXT NOT NULL
);

CREATE INDEX idx_trash_entries_status ON trash_entries(status);
CREATE INDEX idx_trash_entries_expires_at ON trash_entries(expires_at);
```

`snapshot_json` is required. Any deletion proposal must store enough of the original read-model payload to support review, debugging, and rollback analysis.

## Read-Path Behavior

If this proposal is adopted, the read model must define both of these behaviors:

- default read views hide `pending` trash entries
- explicit review views can include `pending` trash entries with their original context intact

The proposal does not allow silent disappearance. A hidden message must still be discoverable via `tgsm trash list` and related review flows.

## Safety Defaults

If implemented, these are the recommended defaults:

- recovery window: `10m`
- all delete commands support `--dry-run`
- delete commands emit a full review payload before any state changes
- messages with first-degree backreplies require stronger warnings
- messages at the root of active threads should be protected by policy until proven safe
- rate limits must cap both delete requests and hard-delete execution

## Access-Control Hooks

This proposal is where a DI layer starts paying off, but the product spec should still describe the behavior rather than the framework.

The policy hooks to reserve are:

- `canDelete(message)`
- `canRestore(trashEntry)`
- `canPurge(trashEntry)`
- `listDeletionWarnings(message)`

Examples of useful policies:

- protect thread roots
- warn on backreplies
- require reason strings for agent-initiated deletes
- cap deletes per hour
- block deletion of explicitly pinned or preserved items

## UX Options

The proposal intentionally keeps multiple review surfaces open:

- CLI review
  - lowest infrastructure cost
  - should be the default first option if this proposal graduates
- Telegram bot review
  - useful for out-of-terminal confirmation
  - not part of the sharp basis
- Thin web review
  - useful for batch review
  - should consume the same trash APIs as the CLI
- TUI review
  - speculative and lower priority than the above

The proposal does not choose one now. The CLI remains the baseline fallback.

## Key Risks

- Hiding queued messages may surprise users if the trash surface is weak.
- Auto-delete on expiry can create irreversible outcomes after inattentive sessions.
- Auto-keep on expiry can create clutter and operational ambiguity.
- Messages with backreplies can lose context even if the message itself seemed disposable.
- A weak snapshot format would make rollback trust impossible.

## Open Questions

- Should timeout default to `auto-delete` or `auto-keep`?
- Should queueing a delete hide the message from default read views immediately or only after explicit confirmation?
- Should different review surfaces share the same recovery window?
- Should some classes of message be undeletable by policy?
- How much context should `tgsm trash list` inline by default?

## Acceptance Gates Before Adoption

This proposal should not move into the main roadmap until all of the following are true:

1. The read-model docs already define context assembly and missing-reference behavior clearly.
2. The cache model can round-trip a deleted item's review snapshot.
3. The CLI output contract can represent warnings and review payloads consistently in default text mode and `--json`.
4. At least one review surface is specified end-to-end, ideally CLI-first.
5. Undo and audit semantics are tested against realistic thread-root and backreply cases.

## Why Not Yet

Deletion is valuable, but it is downstream of the main problem. `tgsm` first needs to make the backlog legible to agents and humans. Once the read model is trustworthy, deletion becomes a constrained mutation layer instead of the product's organizing principle.
