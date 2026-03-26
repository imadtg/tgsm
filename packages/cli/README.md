# tgsm source CLI

This package contains the source CLI used to build the published `tgsm` binaries.
It is an internal workspace package, not the public npm distribution target.

## Development

```bash
bun install
bun run packages/cli/src/index.ts --help
```

The public package is `@imadtg/tgsm`, which now ships a platform-resolving launcher plus per-platform standalone binaries.
