# Output Contract

This document defines how the CLI presents the read model to agents and humans.

## Output Modes

`tgsm` has two first-class output modes:

- default compact text output for direct reading by agents and humans
- explicit `--json` output for strict machine parsing

Both modes must expose the same semantics. Text mode is not a lossy "pretty print" layer over unrelated data.

## Default Text Mode

### Goals

- compact
- readable in shell transcripts
- predictable enough for agents to parse heuristically
- lower token overhead than verbose JSON for common inspection flows

### Formatting Rules

- use stable section headers for compound responses
- keep one message summary per block
- prefer labeled lines over wide tables when context is nested
- show dialog scope prominently
- keep previews short and bounded
- reserve `stderr` for diagnostics and operational noise

Current implementation note:

- JSON mode is the stricter interchange contract
- text mode is stable at the section-and-label level, but still intentionally lighter-weight than JSON

### Example Shape: `messages get`

```text
msg self:42 date=2025-01-15T10:30:00Z self=1 fwd=0 reply=1 kids=2 desc=4 media=-
txt "this yt video on CRDT is amazing"
reply self:38 "need to learn more about distributed..."
kid self:45 "ok so the key insight is..."
kid self:47 "actually this conflicts with..."
before self:41 "also check this paper on..."
after self:43 "unrelated: need to buy groceries"
```

## JSON Mode

### Rules

- enabled only with `--json`
- emits valid JSON on `stdout`
- must conform to the contracts in [Read Model Spec](./read-model.md)
- must omit diagnostic chatter from `stdout`

### Stability

- field names are stable once documented
- additive fields are allowed
- breaking structural changes require explicit documentation

## Discoverability

- help text must be concise and shell-readable
- commands should follow `resource action`
- error responses should suggest the next useful command where appropriate
- any command returning scoped results must make its scope obvious
- bare numeric selectors may default to `self:<message_id>` in text mode, but JSON must still emit the explicit `saved_peer_id`

## Filtering And Projection

Field projection is a plausible future extension, but it is not part of the current CLI surface.

If added later:

- it should work in both text and JSON modes
- it must not alter the underlying retrieval semantics
- it should be documented in both the README and command help, not only here

## Paging And Cursors

- list commands should prefer cursor-based pagination over offset assumptions once a stable cursor exists
- text mode may summarize pagination tersely
- JSON mode must expose `next_cursor`

## `stdout` And `stderr`

- `stdout` is for the primary result only
- `stderr` is for progress, warnings, auth prompts, and diagnostics
- commands intended for piping must remain script-safe in both default and `--json` modes

## Error Contract

Errors should be compact and actionable.

Required semantics:

- stable error `code`
- concise `message`
- `retryable` boolean
- `suggestion` when a next step is obvious

Example JSON error:

```json
{
  "code": "MESSAGE_NOT_FOUND",
  "message": "Message 42 was not found in the selected scope.",
  "retryable": false,
  "suggestion": "Run `tgsm messages list` or widen the dialog scope."
}
```

## Why Not JSON-Only

JSON remains essential for strict scripting, but the default contract should optimize for shell-native agent operation and transcript efficiency. `agent-browser` is a credible precedent for compact default text with optional JSON.

## Why Not Markdown-Only

Text mode should be markdown-like and predictable, but `--json` remains necessary for strict parsing, regression tests, and ecosystem interoperability.
