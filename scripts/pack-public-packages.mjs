#!/usr/bin/env node

import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const outDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : await mkdtemp(path.join(os.tmpdir(), 'tgsm-public-pack-'))

const packageDirs = [
  'packages/tgsm-linux-x64',
  'packages/tgsm-linux-arm64',
  'packages/tgsm-darwin-x64',
  'packages/tgsm-darwin-arm64',
  'packages/tgsm-windows-x64',
  'packages/tgsm-windows-arm64',
  'packages/npm-wrapper',
]

for (const packageDir of packageDirs) {
  const result = spawnSync(
    'npm',
    ['pack', path.join(repoRoot, packageDir), '--pack-destination', outDir, '--silent'],
    { cwd: repoRoot, stdio: 'inherit' },
  )

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

process.stdout.write(`${outDir}\n`)
