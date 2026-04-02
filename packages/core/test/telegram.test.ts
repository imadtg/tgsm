import { tl } from '@mtcute/node'
import { describe, expect, test } from 'bun:test'
import {
  describeTelegramFailure,
  isLegacySqliteSession,
  isTelegramAuthInvalidError,
  isTelegramAuthMissingError,
  normalizeRawMessage,
} from '../src/index'

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

describe('describeTelegramFailure', () => {
  test('preserves plain-string failures', () => {
    expect(describeTelegramFailure('boom', 'fallback')).toBe('boom')
  })

  test('preserves message-like object failures', () => {
    expect(describeTelegramFailure({ message: 'rpc failed' }, 'fallback')).toBe('rpc failed')
  })

  test('falls back when the failure cannot be described', () => {
    expect(describeTelegramFailure(null, 'fallback')).toBe('fallback')
  })
})

describe('isLegacySqliteSession', () => {
  test('detects legacy sqlite session files', () => {
    expect(isLegacySqliteSession(Buffer.from('SQLite format 3\0extra bytes'))).toBe(true)
  })

  test('ignores string-session files', () => {
    expect(isLegacySqliteSession(Buffer.from('1AQAOMT...'))).toBe(false)
  })
})

describe('telegram auth error helpers', () => {
  test('treats invalidated sessions as invalid auth', () => {
    expect(isTelegramAuthInvalidError(new tl.RpcError(401, 'AUTH_KEY_UNREGISTERED'))).toBe(true)
    expect(isTelegramAuthInvalidError(new tl.RpcError(401, 'SESSION_REVOKED'))).toBe(true)
  })

  test('treats 2fa-needed sessions as missing auth for non-login flows', () => {
    expect(isTelegramAuthMissingError(new tl.RpcError(401, 'SESSION_PASSWORD_NEEDED'))).toBe(true)
  })

  test('ignores unrelated rpc failures', () => {
    expect(isTelegramAuthMissingError(new tl.RpcError(420, 'FLOOD_WAIT_10'))).toBe(false)
  })
})
