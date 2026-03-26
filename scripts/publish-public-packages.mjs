#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const publishOrder = [
  'packages/tgsm-linux-x64',
  'packages/tgsm-linux-arm64',
  'packages/tgsm-darwin-x64',
  'packages/tgsm-darwin-arm64',
  'packages/tgsm-windows-x64',
  'packages/tgsm-windows-arm64',
  'packages/npm-wrapper',
]

for (const packageDir of publishOrder) {
  const result = spawnSync('npm', ['publish', '--access', 'public'], {
    cwd: path.join(repoRoot, packageDir),
    stdio: 'inherit',
    env: process.env,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
