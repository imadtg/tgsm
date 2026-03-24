# AGENTS.md

Use this file as the entry point for repository operations and documentation routing.

## Start Here

- [README.md](README.md): user-facing overview and live CLI surface
- [docs/README.md](docs/README.md): canonical documentation index and authority map
- [ROADMAP.md](ROADMAP.md): product scope and the sharp basis
- [BACKLOG.md](BACKLOG.md): backlog routing and deferred findings

## Product Specs

- [docs/spec/product.md](docs/spec/product.md): product contract
- [docs/spec/read-model.md](docs/spec/read-model.md): canonical read model
- [docs/spec/output-contract.md](docs/spec/output-contract.md): CLI output contract
- [docs/spec/architecture-boundaries.md](docs/spec/architecture-boundaries.md): required architecture seams

## Operations Docs

- [docs/operations/README.md](docs/operations/README.md): current install, test, debug, build, and release behavior
- [docs/operations/security.md](docs/operations/security.md): security-relevant behavior that exists today
- [docs/operations/tooling-and-packaging.md](docs/operations/tooling-and-packaging.md): current implementation baseline for tooling and packaging
- [docs/operations/workarounds.md](docs/operations/workarounds.md): machine-specific fixes that were useful on one development machine

## Tracked But Not Implemented

- [docs/decisions/open-decisions.md](docs/decisions/open-decisions.md): unresolved high-leverage decisions
- [docs/backlogs/operations.md](docs/backlogs/operations.md): operational ideas and missing features that are not implemented yet
- [docs/backlogs/usability.md](docs/backlogs/usability.md): retrieval and CLI usability findings worth preserving
- [docs/proposals/soft-delete.md](docs/proposals/soft-delete.md): mutation proposal, not current behavior
- [docs/proposals/future-ideas.md](docs/proposals/future-ideas.md): longer-horizon ideas, not roadmap commitments

## Working Rules For This Repo

- Prefer Bun for workspace, install, build, test, and publish flows.
- Treat Telegram as the source of truth; local state is cache/session/operational state only.
- Prefer high-level operational docs over machine-specific fixes.
- Use [docs/operations/workarounds.md](docs/operations/workarounds.md) only when the higher-level operational path is blocked.
- Do not assume proposed features exist unless they are documented as implemented in code-facing or operations docs.

## When Changing Docs

- Put implemented behavior in the main docs.
- Put machine-local quirks in [docs/operations/workarounds.md](docs/operations/workarounds.md).
- Put unimplemented operational ideas in [docs/backlogs/operations.md](docs/backlogs/operations.md), not in authoritative docs.
- Do not describe chosen libraries as open options unless they are genuinely undecided again.
