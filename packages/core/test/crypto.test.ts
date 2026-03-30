import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { afterAll, describe, expect, test } from 'bun:test'

const tempDirs: string[] = []

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('TgsmCryptoProvider', () => {
  test('initializes inside a compiled Bun binary', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'tgsm-crypto-test-'))
    tempDirs.push(tmpDir)

    const sourcePath = path.join(tmpDir, 'probe.ts')
    const binaryPath = path.join(tmpDir, 'probe')
    const cryptoModulePath = path.resolve(import.meta.dir, '../src/crypto.ts')

    await writeFile(
      sourcePath,
      [
        `import { TgsmCryptoProvider } from ${JSON.stringify(cryptoModulePath)}`,
        'const provider = new TgsmCryptoProvider()',
        'await provider.initialize()',
        'const cipher = provider.createAesIge(new Uint8Array(32), new Uint8Array(32))',
        "process.stdout.write(cipher.encrypt(new Uint8Array(32)).length === 32 ? 'ok\\n' : 'bad\\n')",
      ].join('\n'),
      'utf8',
    )

    const build = spawnSync('bun', ['build', '--compile', `--outfile=${binaryPath}`, sourcePath], {
      cwd: path.resolve(import.meta.dir, '../../..'),
      encoding: 'utf8',
    })

    expect(build.status).toBe(0)

    const run = spawnSync(binaryPath, [], {
      cwd: path.resolve(import.meta.dir, '../../..'),
      encoding: 'utf8',
    })

    expect(run.status).toBe(0)
    expect(run.stdout.trim()).toBe('ok')
  }, 30_000)
})
