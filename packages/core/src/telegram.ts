import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { readFile, writeFile } from 'node:fs/promises'
import { TelegramClient, getMarkedPeerId, type tl } from '@mtcute/node'
import { TgsmError } from './errors'
import type {
  AuthStatus,
  CacheMessageRecord,
  ForwardOriginSummary,
  LinkSummary,
  SavedDialogSummary,
  SourceSnapshot,
  TelegramLoginInput,
  TgsmSourceAdapter,
} from './types'

interface TelegramConfig {
  apiId: number
  apiHash: string
  phone?: string
}

interface EntityLookup {
  users: Map<number, tl.TypeUser>
  chats: Map<number, tl.TypeChat>
  selfUserId: number
}

export class TelegramSource implements TgsmSourceAdapter {
  readonly backend = 'telegram' as const

  async authLogin(accountDir: string, input: TelegramLoginInput): Promise<AuthStatus> {
    const config: TelegramConfig = {
      apiId: input.apiId,
      apiHash: input.apiHash,
      phone: input.phone,
    }

    await saveTelegramConfig(accountDir, config)
    const client = new TelegramClient({
      apiId: config.apiId,
      apiHash: config.apiHash,
      storage: path.join(accountDir, 'mtcute-session'),
    })
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    })

    try {
      const user = await client.start({
        phone: input.phone,
        code: async () => {
          if (input.code && input.code.trim().length > 0) {
            return input.code
          }

          return rl.question('Code: ')
        },
        password: async () =>
          input.password ??
          (await rl.question('2FA password (leave empty if not enabled): ')),
        codeSentCallback: async (sentCode) => {
          const type =
            typeof sentCode.type === 'string'
              ? sentCode.type
              : 'unknown'
          process.stderr.write(`Login code requested via ${type}.\n`)
        },
        invalidCodeCallback: async (type) => {
          process.stderr.write(`Invalid ${type}, please try again.\n`)
        },
      })

      return {
        authenticated: true,
        user: {
          id: String(user.id),
          display_name: user.displayName,
        },
      }
    } catch (error) {
      throw new TgsmError({
        code: 'AUTH_FAILED',
        message: error instanceof Error ? error.message : 'Telegram auth failed.',
        retryable: false,
      })
    } finally {
      rl.close()
      // no-op: client storage/session is managed by mtcute
    }
  }

  async authStatus(accountDir: string): Promise<AuthStatus> {
    const config = await loadTelegramConfig(accountDir)
    if (!config) {
      return {
        authenticated: false,
        user: null,
      }
    }

    const client = new TelegramClient({
      apiId: config.apiId,
      apiHash: config.apiHash,
      storage: path.join(accountDir, 'mtcute-session'),
    })

    try {
      await client.start({})
      const me = await client.getMe()
      return {
        authenticated: true,
        user: {
          id: String(me.id),
          display_name: me.displayName,
        },
      }
    } catch {
      return {
        authenticated: false,
        user: null,
      }
    } finally {
      // no-op: client storage/session is managed by mtcute
    }
  }

  async sync(accountDir: string): Promise<SourceSnapshot> {
    const config = await loadTelegramConfig(accountDir)
    if (!config) {
      throw new TgsmError({
        code: 'AUTH_REQUIRED',
        message: 'Telegram credentials are not configured.',
        retryable: false,
        suggestion: 'Run `tgsm auth login` first.',
      })
    }

    const client = new TelegramClient({
      apiId: config.apiId,
      apiHash: config.apiHash,
      storage: path.join(accountDir, 'mtcute-session'),
    })

    try {
      const me = await client.start({})
      const syncedAt = new Date().toISOString()
      const dialogsResponse = await client.call({
        _: 'messages.getSavedDialogs',
        excludePinned: false,
        offsetDate: 0,
        offsetId: 0,
        offsetPeer: { _: 'inputPeerEmpty' },
        limit: 1000,
        hash: 0 as never,
      })

      if (dialogsResponse._ === 'messages.savedDialogsNotModified') {
        return {
          backend: this.backend,
          account: {
            id: String(me.id),
            display_name: me.displayName,
          },
          dialogs: [],
          messages: [],
          synced_at: syncedAt,
        }
      }

      const lookup: EntityLookup = {
        users: new Map(),
        chats: new Map(),
        selfUserId: Number(me.id),
      }

      ingestEntities(lookup, dialogsResponse.users, dialogsResponse.chats)

      const dialogs: SavedDialogSummary[] = []
      const messagesByKey = new Map<string, CacheMessageRecord>()

      for (const dialog of dialogsResponse.dialogs) {
        if (dialog._ !== 'savedDialog') continue

        const savedPeerId = savedPeerIdFromPeer(dialog.peer, lookup.selfUserId)
        const peerInput = await client.resolvePeer(getMarkedPeerId(dialog.peer))
        const title = peerTitle(dialog.peer, lookup)

        const messages = await fetchSavedHistory(client, peerInput, lookup)
        const topMessage = messages.find((message) => message.message_id === dialog.topMessage) ?? messages[0] ?? null

        dialogs.push({
          saved_peer_id: savedPeerId,
          kind: peerKindFromPeer(dialog.peer, lookup.selfUserId),
          title,
          top_message_id: dialog.topMessage ?? topMessage?.message_id ?? null,
          top_text_preview: topMessage ? previewText(topMessage.text) : null,
          message_count: messages.length,
          pinned: dialog.pinned ?? null,
          last_synced_at: syncedAt,
        })

        for (const message of messages) {
          messagesByKey.set(`${message.saved_peer_id}:${message.message_id}`, message)
        }
      }

      return {
        backend: this.backend,
        account: {
          id: String(me.id),
          display_name: me.displayName,
        },
        dialogs,
        messages: [...messagesByKey.values()].sort((a, b) =>
          a.saved_peer_id.localeCompare(b.saved_peer_id) || a.date.localeCompare(b.date) || a.message_id - b.message_id,
        ),
        synced_at: syncedAt,
      }
    } catch (error) {
      throw new TgsmError({
        code: 'TELEGRAM_SYNC_FAILED',
        message: error instanceof Error ? error.message : 'Telegram sync failed.',
        retryable: true,
      })
    } finally {
      // no-op: client storage/session is managed by mtcute
    }
  }
}

async function fetchSavedHistory(
  client: TelegramClient,
  peer: tl.TypeInputPeer,
  lookup: EntityLookup,
): Promise<CacheMessageRecord[]> {
  let offsetId = 0
  let offsetDate = 0
  const records = new Map<string, CacheMessageRecord>()

  while (true) {
    const history = await client.call({
      _: 'messages.getSavedHistory',
      peer,
      offsetId,
      offsetDate,
      addOffset: 0,
      limit: 100,
      maxId: 0,
      minId: 0,
      hash: 0 as never,
    })

    if (!('messages' in history)) {
      break
    }

    ingestEntities(lookup, history.users ?? [], history.chats ?? [])

    const rawMessages = history.messages.filter(
      (message: tl.TypeMessage): message is tl.RawMessage | tl.RawMessageService =>
        message._ === 'message' || message._ === 'messageService',
    )

    if (rawMessages.length === 0) {
      break
    }

    for (const raw of rawMessages) {
      const record = normalizeRawMessage(raw, lookup)
      records.set(`${record.saved_peer_id}:${record.message_id}`, record)
    }

    const oldest = rawMessages[rawMessages.length - 1]!
    offsetId = oldest.id
    offsetDate = oldest.date

    if (rawMessages.length < 100) {
      break
    }
  }

  return [...records.values()].sort((a, b) => a.date.localeCompare(b.date) || a.message_id - b.message_id)
}

function normalizeRawMessage(raw: tl.RawMessage | tl.RawMessageService, lookup: EntityLookup): CacheMessageRecord {
  const savedPeerId = savedPeerIdFromPeer(raw.peerId, lookup.selfUserId)
  const replyHeader =
    'replyTo' in raw && raw.replyTo && raw.replyTo._ === 'messageReplyHeader' ? raw.replyTo : null
  const replyPeer = replyHeader?.replyToPeerId ?? raw.peerId
  const fwdFrom = 'fwdFrom' in raw ? raw.fwdFrom : undefined
  const editDate = 'editDate' in raw ? raw.editDate : undefined
  const media = 'media' in raw ? raw.media : undefined
  const text = 'message' in raw ? raw.message : ''

  return {
    message_id: raw.id,
    saved_peer_id: savedPeerId,
    date: new Date(raw.date * 1000).toISOString(),
    edit_date: editDate ? new Date(editDate * 1000).toISOString() : null,
    text,
    from_self: peerIsSelf('fromId' in raw ? raw.fromId : null, lookup.selfUserId),
    forwarded: Boolean(fwdFrom),
    forward_origin: fwdFrom ? forwardOriginFromHeader(fwdFrom, lookup) : null,
    reply_to_message_id: replyHeader?.replyToMsgId ?? null,
    reply_to_saved_peer_id: replyHeader?.replyToMsgId
      ? savedPeerIdFromPeer(replyPeer, lookup.selfUserId)
      : null,
    links: extractLinks(text),
    media_summary: mediaSummary(media),
    queued_for_delete: false,
  }
}

function forwardOriginFromHeader(
  header: tl.RawMessageFwdHeader,
  lookup: EntityLookup,
): ForwardOriginSummary {
  if (header.savedFromPeer) {
    return {
      saved_peer_id: savedPeerIdFromPeer(header.savedFromPeer, lookup.selfUserId),
      title: peerTitle(header.savedFromPeer, lookup),
      message_id: header.savedFromMsgId ?? null,
    }
  }

  if (header.fromId) {
    return {
      saved_peer_id: savedPeerIdFromPeer(header.fromId, lookup.selfUserId),
      title: header.fromName ?? peerTitle(header.fromId, lookup),
      message_id: header.savedFromMsgId ?? null,
    }
  }

  return {
    saved_peer_id: null,
    title: header.fromName ?? header.savedFromName ?? null,
    message_id: header.savedFromMsgId ?? null,
  }
}

function peerIsSelf(peer: tl.TypePeer | undefined | null, selfUserId: number): boolean {
  return Boolean(peer && peer._ === 'peerUser' && peer.userId === selfUserId)
}

function peerKindFromPeer(peer: tl.TypePeer, selfUserId: number): SavedDialogSummary['kind'] {
  if (peer._ === 'peerUser' && peer.userId === selfUserId) return 'self'
  if (peer._ === 'peerUser' || peer._ === 'peerChat') return 'peer'
  if (peer._ === 'peerChannel') return 'channel'
  return 'unknown'
}

export function savedPeerIdFromPeer(peer: tl.TypePeer, selfUserId: number): string {
  if (peer._ === 'peerUser' && peer.userId === selfUserId) {
    return 'self'
  }

  if (peer._ === 'peerUser') return `user:${peer.userId}`
  if (peer._ === 'peerChat') return `chat:${peer.chatId}`
  if (peer._ === 'peerChannel') return `channel:${peer.channelId}`
  return `unknown:${getMarkedPeerId(peer)}`
}

function peerTitle(peer: tl.TypePeer, lookup: EntityLookup): string {
  if (peer._ === 'peerUser') {
    if (peer.userId === lookup.selfUserId) return 'Self'
    const user = lookup.users.get(peer.userId)
    const firstName = user && user._ === 'user' ? user.firstName ?? '' : ''
    const lastName = user && user._ === 'user' ? user.lastName ?? '' : ''
    const username = user && user._ === 'user' ? user.username ?? '' : ''
    const parts = [firstName, lastName].filter(Boolean)
    return parts.join(' ').trim() || username || `User ${peer.userId}`
  }

  const entity = lookup.chats.get(peer._ === 'peerChat' ? peer.chatId : peer.channelId)
  if (entity && 'title' in entity) {
    return entity.title
  }

  if (peer._ === 'peerChat') return `Chat ${peer.chatId}`
  if (peer._ === 'peerChannel') return `Channel ${peer.channelId}`
  return 'Unknown'
}

function ingestEntities(lookup: EntityLookup, users: tl.TypeUser[], chats: tl.TypeChat[]): void {
  for (const user of users) {
    if ('id' in user) {
      lookup.users.set(Number(user.id), user)
    }
  }

  for (const chat of chats) {
    if ('id' in chat) {
      lookup.chats.set(Number(chat.id), chat)
    }
  }
}

function extractLinks(text: string): LinkSummary[] {
  const matches = text.matchAll(/https?:\/\/[^\s)]+/g)
  const seen = new Set<string>()
  const links: LinkSummary[] = []

  for (const match of matches) {
    const url = match[0]!
    if (seen.has(url)) continue
    seen.add(url)
    links.push({ url })
  }

  return links
}

function mediaSummary(media: tl.TypeMessageMedia | undefined): string | null {
  if (!media) return null
  return media._
}

function previewText(text: string, limit = 80): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return '(no text)'
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`
}

async function loadTelegramConfig(accountDir: string): Promise<TelegramConfig | null> {
  try {
    const raw = await readFile(path.join(accountDir, 'telegram.json'), 'utf8')
    return JSON.parse(raw) as TelegramConfig
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function saveTelegramConfig(accountDir: string, config: TelegramConfig): Promise<void> {
  await writeFile(
    path.join(accountDir, 'telegram.json'),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  )
}
