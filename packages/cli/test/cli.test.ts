import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { afterEach, describe, expect, test } from 'bun:test'

interface FixtureFile {
  account: {
    id: string
    display_name: string
  }
  dialogs: Array<{
    saved_peer_id: string
    kind: 'self' | 'peer' | 'channel' | 'unknown'
    title: string
    top_message_id: number | null
    top_text_preview: string | null
    message_count: number
    pinned: boolean | null
    last_synced_at: string | null
  }>
  messages: Array<{
    message_id: number
    saved_peer_id: string
    date: string
    edit_date: string | null
    text: string
    from_self: boolean
    forwarded: boolean
    forward_origin: {
      saved_peer_id: string | null
      title: string | null
      message_id: number | null
    } | null
    reply_to_message_id: number | null
    reply_to_saved_peer_id: string | null
    links: Array<{ url: string }>
    media_summary: string | null
    queued_for_delete: boolean
  }>
}

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('tgsm CLI fixture backend', () => {
  test('sync + saved-dialogs list --json returns structured dialogs', async () => {
    const { fixturePath, homeDir } = await setupFixture()

    await expectCliSuccess([
      '--backend',
      'fixture',
      '--fixture',
      fixturePath,
      '--home',
      homeDir,
      'sync',
    ])

    const listed = await expectCliSuccess([
      '--json',
      '--backend',
      'fixture',
      '--fixture',
      fixturePath,
      '--home',
      homeDir,
      'saved-dialogs',
      'list',
    ])

    const dialogs = JSON.parse(listed.stdout) as FixtureFile['dialogs']
    expect(dialogs).toHaveLength(2)
    expect(dialogs.map((dialog) => dialog.saved_peer_id).sort()).toEqual(['channel:42', 'self'])
  })

  test('messages get default text output includes context sections', async () => {
    const { fixturePath, homeDir } = await setupFixture()

    await expectCliSuccess([
      '--backend',
      'fixture',
      '--fixture',
      fixturePath,
      '--home',
      homeDir,
      'sync',
    ])

    const shown = await expectCliSuccess([
      '--backend',
      'fixture',
      '--fixture',
      fixturePath,
      '--home',
      homeDir,
      'messages',
      'get',
      '2',
    ])

    expect(shown.stdout).toContain('MESSAGE #2')
    expect(shown.stdout).toContain('reply_to:')
    expect(shown.stdout).toContain('backreplies:')
    expect(shown.stdout).toContain('chronology_before:')
    expect(shown.stdout).toContain('chronology_after:')
  })
})

async function setupFixture(): Promise<{ fixturePath: string; homeDir: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tgsm-cli-test-'))
  tempDirs.push(dir)

  const fixturePath = path.join(dir, 'fixture.json')
  const homeDir = path.join(dir, 'home')
  const fixture = buildFixture()

  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')

  return { fixturePath, homeDir }
}

function buildFixture(): FixtureFile {
  return {
    account: {
      id: 'fixture',
      display_name: 'Fixture Account',
    },
    dialogs: [
      {
        saved_peer_id: 'self',
        kind: 'self',
        title: 'Self',
        top_message_id: 4,
        top_text_preview: 'Later summary',
        message_count: 4,
        pinned: false,
        last_synced_at: null,
      },
      {
        saved_peer_id: 'channel:42',
        kind: 'channel',
        title: 'Interesting Channel',
        top_message_id: 10,
        top_text_preview: 'Forwarded bookmark',
        message_count: 1,
        pinned: false,
        last_synced_at: null,
      },
    ],
    messages: [
      {
        message_id: 1,
        saved_peer_id: 'self',
        date: '2025-01-15T10:00:00.000Z',
        edit_date: null,
        text: 'Need to revisit CRDT notes',
        from_self: true,
        forwarded: false,
        forward_origin: null,
        reply_to_message_id: null,
        reply_to_saved_peer_id: null,
        links: [],
        media_summary: null,
        queued_for_delete: false,
      },
      {
        message_id: 2,
        saved_peer_id: 'self',
        date: '2025-01-15T10:05:00.000Z',
        edit_date: null,
        text: 'This video is great https://example.com/crdt',
        from_self: true,
        forwarded: false,
        forward_origin: null,
        reply_to_message_id: 1,
        reply_to_saved_peer_id: 'self',
        links: [{ url: 'https://example.com/crdt' }],
        media_summary: null,
        queued_for_delete: false,
      },
      {
        message_id: 3,
        saved_peer_id: 'self',
        date: '2025-01-15T10:07:00.000Z',
        edit_date: null,
        text: 'Key insight: merge happens after causal delivery',
        from_self: true,
        forwarded: false,
        forward_origin: null,
        reply_to_message_id: 2,
        reply_to_saved_peer_id: 'self',
        links: [],
        media_summary: null,
        queued_for_delete: false,
      },
      {
        message_id: 4,
        saved_peer_id: 'self',
        date: '2025-01-15T10:09:00.000Z',
        edit_date: null,
        text: 'Later summary',
        from_self: true,
        forwarded: false,
        forward_origin: null,
        reply_to_message_id: null,
        reply_to_saved_peer_id: null,
        links: [],
        media_summary: null,
        queued_for_delete: false,
      },
      {
        message_id: 10,
        saved_peer_id: 'channel:42',
        date: '2025-01-15T09:00:00.000Z',
        edit_date: null,
        text: 'Forwarded bookmark',
        from_self: false,
        forwarded: true,
        forward_origin: {
          saved_peer_id: 'channel:42',
          title: 'Interesting Channel',
          message_id: 99,
        },
        reply_to_message_id: null,
        reply_to_saved_peer_id: null,
        links: [],
        media_summary: null,
        queued_for_delete: false,
      },
    ],
  }
}

async function expectCliSuccess(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: ['bun', 'run', 'packages/cli/src/index.ts', ...args],
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  expect(exitCode).toBe(0)
  return { stdout, stderr }
}
