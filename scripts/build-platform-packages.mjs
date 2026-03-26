#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { mkdir, chmod } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const sourceEntry = path.join(repoRoot, 'packages/cli/src/index.ts')
const wrapperVersion = readJson(path.join(repoRoot, 'packages/npm-wrapper/package.json')).version
const bunExecutable = process.execPath

const targets = [
  {
    packageDir: 'packages/tgsm-linux-x64',
    target: 'bun-linux-x64-baseline',
  },
  {
    packageDir: 'packages/tgsm-linux-arm64',
    target: 'bun-linux-arm64',
  },
  {
    packageDir: 'packages/tgsm-darwin-x64',
    target: 'bun-darwin-x64',
  },
  {
    packageDir: 'packages/tgsm-darwin-arm64',
    target: 'bun-darwin-arm64',
  },
  {
    packageDir: 'packages/tgsm-windows-x64',
    target: 'bun-windows-x64-baseline',
  },
  {
    packageDir: 'packages/tgsm-windows-arm64',
    target: 'bun-windows-arm64',
  },
]

const filter = process.env.TGSM_PLATFORM_FILTER
const selectedTargets = filter
  ? targets.filter((item) => item.packageDir === filter || item.packageDir.endsWith(`/${filter}`))
  : targets

if (selectedTargets.length === 0) {
  process.stderr.write(`No platform targets matched TGSM_PLATFORM_FILTER=${filter}\n`)
  process.exit(1)
}

const bunVersion = readBunVersion()
if (versionLt(bunVersion, '1.3.11') && selectedTargets.some((item) => item.target === 'bun-windows-arm64')) {
  process.stderr.write(
    `tgsm packaging requires Bun 1.3.11+ for the full target matrix; detected Bun ${bunVersion}.\n`,
  )
}

for (const build of selectedTargets) {
  const outDir = path.join(repoRoot, build.packageDir, 'bin')
  const outfile = path.join(outDir, 'tgsm.exe')
  await mkdir(outDir, { recursive: true })

  const result = spawnSync(
    bunExecutable,
    [
      'build',
      '--compile',
      `--target=${build.target}`,
      `--outfile=${outfile}`,
      sourceEntry,
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        TGSM_VERSION: wrapperVersion,
      },
    },
  )

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  if (!build.target.includes('windows')) {
    await chmod(outfile, 0o755)
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function readBunVersion() {
  return process.versions.bun || '0.0.0'
}

function versionLt(left, right) {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  const len = Math.max(leftParts.length, rightParts.length)

  for (let i = 0; i < len; i += 1) {
    const a = leftParts[i] ?? 0
    const b = rightParts[i] ?? 0
    if (a < b) return true
    if (a > b) return false
  }

  return false
}
