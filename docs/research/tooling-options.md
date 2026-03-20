# Tooling Options Research

This document records implementation options around workspace layout, packaging, releases, and framework choices. It is research, not the product spec.

## Workspace Shape

The earlier docs were directionally fine to prefer Bun, but they mixed workspace and release choices into the product plan too early.

Current lean:

- Bun workspaces are a good default for local development.
- A monorepo is still reasonable if it starts minimal.
- The high-level docs should only assume two near-term packages:
  - core
  - CLI

Future consumers like bot or web should be framed as optional later packages, not part of the initial contract.

## Release Tooling

Changesets remains a credible option if `tgsm` stays a multi-package repo and wants reviewable version bumps.

What makes it attractive:

- good monorepo support
- explicit release intent
- per-package changelog control

What it should not do:

- drive the roadmap
- appear in the first paragraph of the product description
- force early decisions about future packages that do not yet exist

## CLI Framework Choice

There is no research basis yet for treating `@effect/cli` as a product-level commitment.

Reasonable options remain:

- `@effect/cli`
  - strong alignment if Effect becomes the real implementation backbone
- `citty`
  - lightweight and modern
- `commander`
  - conservative and familiar
- `clipanion`
  - structured and type-friendly

Research takeaway:

- the CLI framework should be chosen based on implementation ergonomics after the public contract is fixed
- it should not leak into the top-level roadmap unless it creates user-visible constraints

## Architecture Frameworks

Effect is still a strong candidate for:

- dependency injection
- typed errors
- lifecycle management
- wrapping mutation paths with safety layers

But this is an implementation choice. The product docs should describe behavior and boundaries first, then mention Effect as the leading candidate in research or architecture notes.

## Minimal Near-Term Package Layout

The leanest credible layout is:

- `packages/core`
- `packages/cli`

Optional later additions:

- `packages/bot`
- `packages/web`

This keeps the repo compatible with a monorepo strategy without making later consumers look mandatory.

## Sources

- Bun workspaces
  - https://bun.sh/docs/install/workspaces
- Changesets
  - https://github.com/changesets/changesets
- Effect repository
  - https://github.com/Effect-TS/effect
- Hypothesis
  - The eventual CLI framework choice should be settled by a small prototype against the locked read-model and output-contract docs rather than by paper comparison alone.
