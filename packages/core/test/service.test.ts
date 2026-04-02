import os from 'node:os'
import path from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { beforeEach, describe, expect, test } from 'bun:test'
import { FixtureSource, TgsmError, TgsmService } from '../src/index'

const fixturePath = path.resolve(
  import.meta.dir,
  './fixtures/sample-saved-messages.json',
)

let tempDir: string
let service: TgsmService

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'tgsm-core-'))
  service = new TgsmService({
    cachePath: path.join(tempDir, 'cache.json'),
    source: new FixtureSource(fixturePath),
  })
  await service.sync()
})

describe('TgsmService with fixture backend', () => {
  test('lists saved dialogs across the cache', async () => {
    const dialogs = await service.listSavedDialogs()

    expect(dialogs).toHaveLength(2)
    expect(dialogs.map((dialog) => dialog.saved_peer_id).sort()).toEqual(['self', 'user:200'])
  })

  test('builds a hybrid context bundle with reply and backreply context', async () => {
    const bundle = await service.getMessage(2, { dialog: 'self' })

    expect(bundle.target.message_id).toBe(2)
    expect(bundle.target.reply.exists).toBe(true)
    expect(bundle.target.reply.target?.message_id).toBe(1)
    expect(bundle.target.backreplies.map((item) => item.message.message_id)).toEqual([3, 8])
    expect(bundle.target.links.map((item) => item.url)).toEqual([
      'https://youtube.com/watch?v=crdt',
    ])
    expect(bundle.context_messages.some((item) => item.context_roles.includes('chronology_after'))).toBe(true)
  })

  test('inspects a reply thread from its root', async () => {
    const thread = await service.inspectThread(3, { dialog: 'self' })

    expect(thread.root.message_id).toBe(1)
    expect(thread.nodes[0]?.children[0]?.message.message_id).toBe(2)
    expect(thread.nodes[0]?.children[0]?.children.map((node) => node.message.message_id)).toEqual([3, 8])
  })

  test('supports scoped search and pagination-friendly list output', async () => {
    const page = await service.listMessages({
      dialog: 'self',
      search: 'rapid fire',
      limit: 2,
    })

    expect(page.scope).toBe('saved_dialog')
    expect(page.saved_peer_id).toBe('self')
    expect(page.result_count).toBe(3)
    expect(page.items).toHaveLength(2)
    expect(page.next_cursor).toBeTruthy()
  })

  test('fails on ambiguous message ids without dialog scope', async () => {
    await expect(service.getMessage(20)).rejects.toMatchObject({
      code: 'AMBIGUOUS_MESSAGE_ID',
    } satisfies Partial<TgsmError>)
  })

  test('inspectMessage defaults bare ids to self selectors when possible', async () => {
    const result = await service.inspectMessage('2')

    expect(result.selector.resolved).toBe('self:2')
    expect(result.selector.defaulted_to_self).toBe(true)
    expect(result.target.saved_peer_id).toBe('self')
  })

  test('inspectMessage expands only requested retrieval surfaces', async () => {
    const result = await service.inspectMessage('self:2', {
      with: ['chronology', 'reply_parent', 'backreplies', 'thread'],
      before: 1,
      after: 1,
      thread_depth: 1,
    })

    expect(result.expansions.reply_parent?.message_id).toBe(1)
    expect(result.expansions.backreplies?.map((item) => item.message_id)).toEqual([3, 8])
    expect(result.expansions.chronology?.before).toHaveLength(1)
    expect(result.expansions.chronology?.after).toHaveLength(1)
    expect(result.expansions.thread?.depth_limit).toBe(1)
    expect(result.expansions.thread?.root.message_id).toBe(1)
  })
})
