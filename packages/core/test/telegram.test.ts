import { describe, expect, test } from 'bun:test'
import { normalizeRawMessage } from '../src/index'

describe('normalizeRawMessage', () => {
  test('treats outgoing Saved Messages entries as from_self even without fromId', () => {
    const record = normalizeRawMessage(
      {
        _: 'message',
        id: 1,
        peerId: { _: 'peerUser', userId: 42 },
        date: 1_700_000_000,
        out: true,
        message: 'hello',
      } as never,
      {
        users: new Map(),
        chats: new Map(),
        selfUserId: 42,
      },
    )

    expect(record.saved_peer_id).toBe('self')
    expect(record.from_self).toBe(true)
  })

  test('treats non-forwarded self-dialog entries as from_self when Telegram omits fromId and out', () => {
    const record = normalizeRawMessage(
      {
        _: 'message',
        id: 2,
        peerId: { _: 'peerUser', userId: 42 },
        date: 1_700_000_000,
        out: false,
        message: 'saved note',
      } as never,
      {
        users: new Map(),
        chats: new Map(),
        selfUserId: 42,
      },
    )

    expect(record.saved_peer_id).toBe('self')
    expect(record.forwarded).toBe(false)
    expect(record.from_self).toBe(true)
  })

  test('keeps forwarded self-dialog entries as not from_self', () => {
    const record = normalizeRawMessage(
      {
        _: 'message',
        id: 3,
        peerId: { _: 'peerUser', userId: 42 },
        date: 1_700_000_000,
        out: false,
        message: 'bookmark',
        fwdFrom: {
          _: 'messageFwdHeader',
          date: 1_700_000_000,
        },
      } as never,
      {
        users: new Map(),
        chats: new Map(),
        selfUserId: 42,
      },
    )

    expect(record.saved_peer_id).toBe('self')
    expect(record.forwarded).toBe(true)
    expect(record.from_self).toBe(false)
  })
})
