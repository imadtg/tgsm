# Changesets

This repo uses Changesets for versioning and publishing.

- add a changeset for any user-visible package change
- merge to `main`
- let the release workflow prepare/publish the next version

Conventional Commits are used for commit hygiene, but Changesets are the source of truth for semver bumps.
