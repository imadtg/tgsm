# Read Model Spec

This is the authoritative contract for how `tgsm` models Telegram Saved Messages in the sharp basis.

## Design Goals

- Model Saved Messages as Telegram actually exposes them, including saved dialogs
- Give agents enough context to make a local decision without recursive overfetch by default
- Preserve Telegram as the source of truth while enriching it with reversible indexes
- Keep traversal rules explicit and bounded

## Core Entities

### `SavedDialogSummary`

A summary of one Saved Messages dialog keyed by `saved_peer_id`.

Required fields:

- `saved_peer_id`: stable string identifier used by the CLI and JSON output
- `kind`: `self` | `peer` | `channel` | `unknown`
- `title`: human-readable label for the dialog
- `top_message_id`: most recent known message in the dialog
- `message_count`: cached count if known
- `pinned`: boolean when the source exposes it, otherwise `null`
- `last_synced_at`: ISO 8601 timestamp

Representation rules:

- `saved_peer_id` must be treated as an opaque identifier at the CLI contract level.
- JSON may include raw Telegram identifiers in a nested `telegram` field, but scripts should not depend on Telegram internals unless explicitly documented.

### `MessageRef`

A lightweight pointer to another message.

Required fields:

- `message_id`
- `saved_peer_id`
- `text_preview`
- `date`
- `relationship`: `reply_to` | `backreply` | `chronology_before` | `chronology_after` | `thread_member`

### `ReplyEdgeSummary`

A forward reply edge from the current message to its immediate parent.

Required fields:

- `exists`: boolean
- `target`: `MessageRef | null`
- `status`: `resolved` | `missing` | `not_fetched`

Current implementation note:

- today's full-cache implementation emits `resolved` or `missing`
- `not_fetched` is reserved for future partial-fetch or mixed-cache backends

### `BackreplyEdgeSummary`

One immediate reverse reply edge pointing to a direct child reply.

Required fields:

- `message`: `MessageRef`
- `thread_depth_from_target`: integer, minimum `1`
- `subtree_size_hint`: integer or `null`

### `ThreadDepthSummary`

Depth and size hints without recursive expansion.

Required fields:

- `ancestors_known`: integer
- `direct_backreply_count`: integer
- `descendant_count_hint`: integer or `null`
- `max_known_depth`: integer or `null`

### `MessageEnvelope`

The canonical message shape returned by the read model.

Required fields:

- `message_id`
- `saved_peer_id`
- `date`
- `edit_date`
- `text`
- `text_preview`
- `from_self`
- `forwarded`: boolean
- `forward_origin`: summary object or `null`
- `reply`: `ReplyEdgeSummary`
- `backreplies`: array of `BackreplyEdgeSummary`
- `thread`: `ThreadDepthSummary`
- `links`: array of extracted URLs with optional preview summaries
- `media_summary`: `null` or concise media descriptor
- `queued_for_delete`: boolean

Rules:

- `from_self` means authored by the authenticated user, not merely present in Saved Messages.
- `forwarded` means the message originates elsewhere and was saved/bookmarked into Saved Messages.
- `queued_for_delete` is always `false` in the sharp basis unless a future mutation proposal is active; the field exists so read paths remain stable later.

### `ContextMessage`

A wrapper used inside context bundles.

Required fields:

- `message`: `MessageEnvelope`
- `context_roles`: array containing any of:
  - `target`
  - `chronology_before`
  - `chronology_after`
  - `reply_parent`
  - `backreply_child`

### `MessageContextBundle`

This remains the canonical hybrid context shape inside the core library.
It is no longer the primary CLI contract.

Required fields:

- `target`: `MessageEnvelope`
- `dialog`: `SavedDialogSummary`
- `context_messages`: ordered array of `ContextMessage`
- `window`: object with:
  - `chronology_total_limit`
  - `chronology_before_count`
  - `chronology_after_count`
  - `direct_reply_ancestor_included`
  - `direct_backreply_count_included`
- `notes`: array of concise warnings or omissions

### `SearchResultPage`

Required fields:

- `items`: array of summary objects
- `scope`: `all_saved_dialogs` | `saved_dialog`
- `saved_peer_id`: string or `null`
- `next_cursor`: opaque string or `null`
- `result_count`: integer

### `OperationError`

Required fields:

- `code`
- `message`
- `retryable`
- `suggestion`

## Context Assembly Rules

### Default Neighborhood

The default context bundle contains:

- the target message
- chronological neighbors around the target
- the target's immediate reply parent, if any
- the target's immediate backreplies, if any

### Chronology Bound

- The total chronological neighborhood is capped at `20` messages.
- The default split is implementation-defined, but it must be balanced around the target when possible.
- JSON output must report the actual before/after counts included.

### Reply And Backreply Bound

- Only first-degree reply ancestry is inlined by default.
- Only first-degree backreplies are inlined by default.
- Deeper ancestry or descendants must be represented via `ThreadDepthSummary` hints.

### Ordering

`context_messages` must be ordered for readability:

1. chronological-before messages in ascending date order
2. immediate reply parent, if not already present in chronology
3. target
4. immediate backreplies
5. chronological-after messages in ascending date order

If one message qualifies for multiple roles, it appears once and lists multiple `context_roles`.

## Dialog Scope Rules

- `messages list` defaults to all saved dialogs unless constrained.
- JSON responses must state whether the scope is all dialogs or one dialog.
- JSON message results must always expose explicit dialog identity through `saved_peer_id`, even when text-mode selector parsing defaults to `self`.

## Missing Reference Rules

- If a reply target cannot be resolved, `reply.status` must explain why.
- Missing references are not silent omissions.
- The bundle's `notes` must mention unresolved edges when they materially affect comprehension.

## Forwarded-Origin Rules

- Forwarded or bookmarked messages must preserve origin context when known.
- A forwarded item remains part of a saved dialog even if the origin lies elsewhere.
- Human output should show origin compactly when it is available and helpful; JSON should expose it structurally.

## Deletion Visibility Rules

- In the sharp basis, messages are either present or absent according to Telegram and cache sync.
- If a future soft-delete proposal is enabled, read paths must surface queued deletion state via `queued_for_delete` rather than silently hiding the message contract.

## CLI Endpoints Bound To This Model

- `tgsm messages list`
- `tgsm messages get <selector>`
- `tgsm sync`

The CLI now exposes one selector-based retrieval command and turns chronology, reply-parent, backreply, and thread traversal into optional expansions on that command.
Those expansions still consume the same underlying read model defined here.

## Scenarios This Model Must Support

- self-authored rapid-fire notes with no explicit reply edges
- explicit reply chains with direct backreplies
- long threads summarized one level deep
- mixed self-authored and forwarded/bookmarked content
- search across all saved dialogs or one saved dialog
- unresolved reply references
