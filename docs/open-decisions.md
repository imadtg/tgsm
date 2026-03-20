# Open Decisions

These are the remaining high-leverage decisions after locking the retrieval-first direction. Everything else should be treated as an implementation default or a later proposal.

## 1. Default Output Stability

`tgsm` is now aiming for compact text by default and `--json` for strict parsing. One decision remains:

- Is the default text output merely human/agent-friendly presentation?
- Or is it a stable contract with a documented grammar that agents can reliably depend on?

Why this matters:

- it affects snapshot testing strategy
- it affects how much freedom the CLI keeps for later formatting improvements
- it determines whether docs must specify both a text contract and a JSON contract with equal rigor

## 2. Saved Dialog Identity

The read model now includes all Saved Message dialogs, not only the self-authored stream. The unresolved piece is how the CLI should present dialog identity by default:

- raw `saved_peer_id`
- a stable canonical string plus display label
- a human label only, with the raw identifier hidden unless requested

Why this matters:

- the choice leaks into filters, output examples, and shell scripting ergonomics
- saved-dialog identity needs to stay stable even if Telegram display names change

## 3. Future Metadata Channel

The sharp basis excludes in-band metadata editing, but the long-term direction is still open:

- native Telegram Saved Message tags
- edited message suffixes
- no in-band metadata, with only operational local state

Why this matters:

- the answer changes how future triage, prioritization, and reordering features are modeled
- native tags may be enough for some use cases
- edited suffixes are more expressive but much riskier

## 4. Soft-Delete Expiry Policy

If the soft-delete proposal graduates later, timeout behavior still needs one product decision:

- `auto-delete`
- `auto-keep`

Why this matters:

- it determines whether the grace window is a safety buffer or an approval queue
- it changes user expectations around unattended sessions

## 5. Multi-Account Horizon

The docs assume one Telegram account for now. What remains open is whether multi-account support should influence the first architecture pass anyway.

Why this matters:

- if near-term, the config and cache layout should reserve account scoping now
- if not near-term, the docs should stay simpler and avoid polluting every command surface with account flags

## Defaults Chosen For Now

Until these are explicitly resolved, the working defaults are:

- default output is compact text, with `--json` available
- saved dialogs are part of the core read model
- no in-band metadata edits in the sharp basis
- soft delete remains a follow-on proposal
- single-account remains the default assumption
