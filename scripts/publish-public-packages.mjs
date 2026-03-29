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
  await publishPackage(packageDir)
}

async function publishPackage(packageDir) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = spawnSync('npm', ['publish', '--access', 'public'], {
      cwd: path.join(repoRoot, packageDir),
      encoding: 'utf8',
      env: process.env,
    })

    if (result.stdout) {
      process.stdout.write(result.stdout)
    }

    if (result.stderr) {
      process.stderr.write(result.stderr)
    }

    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`

    if (result.status === 0 || output.includes('cannot publish over the previously published versions')) {
      return
    }

    if (
      attempt < 5 &&
      /npm error 5\d\d\b|E5\d\d\b|Bad Gateway|Gateway Timeout|Service Unavailable|ECONNRESET|ETIMEDOUT|network request/i.test(
        output,
      )
    ) {
      process.stderr.write(
        `Transient npm publish failure for ${packageDir}; retrying (${attempt}/5).\n`,
      )
      await sleep(2000 * attempt)
      continue
    }

    process.exit(result.status ?? 1)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
