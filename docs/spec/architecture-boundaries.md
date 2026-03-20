# Architecture Boundaries

This document defines the architectural shape required by the product spec without overcommitting implementation details.

## Required Components

- Telegram client adapter
- local cache and index layer
- read model assembly layer
- CLI presentation layer
- optional mutation layer for future proposals

## Responsibilities

### Telegram Client Adapter

- authenticate against Telegram
- read saved dialogs and saved message history
- fetch message details needed for cache hydration
- remain replaceable behind a narrow interface

The product spec does not require a specific library, though [tooling research](../research/tooling-options.md) records the current lean toward mtcute and Effect-based services.

### Local Cache And Indexes

- persist synced Telegram data locally
- index reverse reply edges
- support search and dialog-scoped traversal
- hold operational state such as sync metadata and future recovery state

The cache exists to enrich retrieval, not to replace Telegram as source of truth.

### Read Model Assembly

- turn cached Telegram records into the canonical types from [Read Model Spec](./read-model.md)
- enforce context bounds
- surface missing references explicitly
- expose one stable semantic model to all consumers

### CLI Presentation

- map read model results into default text mode or `--json`
- preserve command grammar and discoverability
- keep `stdout` script-safe

### Optional Mutation Layer

- reserved for proposals such as soft-delete
- must consume the same message identity and read paths
- must not distort the read contract

## Near-Term Package Shape

The high-level docs assume only two near-term packages:

- core
- CLI

Additional packages such as bot or web are valid future consumers, but they are not part of the sharp basis and should not shape the main roadmap.

## Dependency Strategy

- implementation choices such as Bun workspaces, Turborepo, Changesets, and Effect.ts remain options, not product requirements
- the architecture should support dependency injection around Telegram access and mutation boundaries
- the high-level docs should describe seams and responsibilities rather than commit every seam to one framework

## What This Document Intentionally Does Not Lock In

- exact workspace layout
- exact CLI framework
- exact database library
- release automation details
- bot/web package timelines
- semantic search infrastructure

Those belong in research or future proposals until the read model is proven.
