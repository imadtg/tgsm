#!/usr/bin/env node

import { readFileSync } from 'node:fs'
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
const publishExecutable = process.versions.bun ? process.execPath : 'bun'
const publishArgs = ['publish', '--access', 'public']

for (const packageDir of publishOrder) {
  await publishPackage(packageDir)
}

async function publishPackage(packageDir) {
  const packagePath = path.join(repoRoot, packageDir, 'package.json')
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))

  if (isPublished(pkg.name, pkg.version)) {
    process.stdout.write(`Skipping already-published ${pkg.name}@${pkg.version}.\n`)
    return
  }

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = spawnSync(publishExecutable, publishArgs, {
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
      /npm error 5\d\d\b|E5\d\d\b|Bad Gateway|Gateway Timeout|Service Unavailable|ECONNRESET|ETIMEDOUT|network request|ConnectionClosed|ConnectionRefused|Timeout: failed to publish package/i.test(
        output,
      )
    ) {
      process.stderr.write(`Transient publish failure for ${packageDir}; retrying (${attempt}/5).\n`)
      await sleep(2000 * attempt)
      continue
    }

    process.exit(result.status ?? 1)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPublished(name, version) {
  const result = spawnSync('npm', ['view', `${name}@${version}`, 'version', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  })

  if (result.status !== 0) {
    return false
  }

  const output = (result.stdout ?? '').trim()
  return output === JSON.stringify(version) || output === version
}
