# Agent CLI Patterns Research

This document captures observed CLI patterns that appear useful for agent-facing tools. It is research, not the authoritative `tgsm` output contract.

## Strong Patterns

### Text First, Structured On Demand

`agent-browser` is the clearest nearby precedent: its snapshot flow is optimized for compact text output, while `--json` is optional when strict structure is needed.

Why this matters for `tgsm`:

- compact text is often easier for agents to consume in-context
- JSON remains valuable for piping, schema validation, and exact field selection
- a dual contract is credible if both views expose the same semantics

### Script-Safe CLI Behavior

`clig.dev` remains the best general baseline for command-line behavior:

- write machine-consumable results to `stdout`
- write diagnostics and progress to `stderr`
- keep commands non-interactive by default when automation matters
- offer predictable subcommands and stable flags

### Discoverability Beats Cleverness

The current docs were right to prefer noun-verb command shapes and self-documenting help, but overstated the case for JSON-first output. Research supports discoverable CLI grammar more strongly than any single output format.

## What Seems Useful For tgsm

- default output should be compact and scannable, with labeled sections rather than decorative prose
- `--json` should exist wherever a stable machine envelope matters
- field selection is still valuable for token control
- commands should be composable in shells without hidden interactivity
- help text should explain scope boundaries, especially around dialogs, context windows, and mutation safety

## Cautions

- Generic claims like "agents prefer JSON" or "CLI beats MCP" are too broad to be treated as research conclusions on their own.
- MCP should be treated as a later interface option, not as a benchmark that the core CLI must constantly compare itself against.
- Placeholder or vague sources should not be cited as evidence in the top-level spec.

## Suggested Framing For tgsm

- Treat default text output as the primary reading surface.
- Treat `--json` as the exact interchange mode.
- Ensure both modes derive from the same underlying result model.
- Keep agent affordances concrete:
  - stable flags
  - bounded outputs
  - clear errors
  - no surprise prompts

## Sources

- agent-browser snapshots
  - https://agent-browser.dev/snapshots
- CLI Guidelines
  - https://clig.dev/
- Hypothesis
  - The best default text grammar for `tgsm` still needs local iteration against real agent workflows and real Saved Message payloads.
