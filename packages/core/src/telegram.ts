import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { MemoryStorage, TelegramClient, getMarkedPeerId, networkMiddlewares, type tl } from '@mtcute/node'
import { TgsmCryptoProvider } from './crypto'
import { TgsmError } from './errors'
import { getTelegramConfigPath, getTelegramSessionPath } from './paths'
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

interface TelegramSourceOptions {
  debug?: boolean
  logger?: (event: string, fields?: Record<string, unknown>) => void
}

const TELEGRAM_FLOOD_WAIT_MAX_MS = 30_000
const TELEGRAM_CONNECT_TIMEOUT_MS = 30_000
const TELEGRAM_RPC_TIMEOUT_MS = 45_000
const TELEGRAM_DESTROY_TIMEOUT_MS = 5_000
const SQLITE_FILE_HEADER = 'SQLite format 3'

export class TelegramSource implements TgsmSourceAdapter {
  readonly backend = 'telegram' as const

  constructor(private readonly options: TelegramSourceOptions = {}) {}

  async authLogin(accountDir: string, input: TelegramLoginInput): Promise<AuthStatus> {
    const config: TelegramConfig = {
      apiId: input.apiId,
      apiHash: input.apiHash,
      phone: input.phone,
    }

    const client = createTelegramClient(config, this.options)
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    })

    try {
      this.debug('auth.start.begin', { account_dir: accountDir })
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

      this.debug('auth.start.done', { user_id: String(user.id), display_name: user.displayName })
      await persistTelegramState(accountDir, client, config)
      this.debug('auth.state_saved', { account_dir: accountDir, phone: input.phone })
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
        message: describeTelegramFailure(error, 'Telegram auth failed.'),
        retryable: false,
      })
    } finally {
      this.debug('auth.cleanup.begin')
      rl.close()
      const cleanup = await destroyClientQuietly(client)
      this.debug('auth.cleanup.done', { status: cleanup })
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

    const client = createTelegramClient(config, this.options)

    try {
      const imported = await restoreTelegramSession(accountDir, client, this.options)
      if (!imported) {
        this.debug('auth_status.session_missing', { account_dir: accountDir })
        return {
          authenticated: false,
          user: null,
        }
      }

      this.debug('auth_status.check.begin', { account_dir: accountDir })
      const me = await ensureAuthenticatedUser(accountDir, client, this.options)
      this.debug('auth_status.check.done', { user_id: String(me.id), display_name: me.displayName })
      return {
        authenticated: true,
        user: {
          id: String(me.id),
          display_name: me.displayName,
        },
      }
    } catch {
      this.debug('auth_status.check.failed')
      return {
        authenticated: false,
        user: null,
      }
    } finally {
      this.debug('auth_status.cleanup.begin')
      const cleanup = await destroyClientQuietly(client)
      this.debug('auth_status.cleanup.done', { status: cleanup })
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

    const client = createTelegramClient(config, this.options)

    try {
      const imported = await restoreTelegramSession(accountDir, client, this.options)
      if (!imported) {
        throw new TgsmError({
          code: 'AUTH_REQUIRED',
          message: 'Telegram session is not configured.',
          retryable: false,
          suggestion: 'Run `tgsm auth login` first.',
        })
      }

      this.debug('sync.start.begin', { account_dir: accountDir })
      const me = await ensureAuthenticatedUser(accountDir, client, this.options)
      this.debug('sync.start.done', { user_id: String(me.id), display_name: me.displayName })
      const syncedAt = new Date().toISOString()
      this.debug('sync.dialogs.begin')
      const dialogsResponse = await withTimeout(
        client.call({
          _: 'messages.getSavedDialogs',
          excludePinned: false,
          offsetDate: 0,
          offsetId: 0,
          offsetPeer: { _: 'inputPeerEmpty' },
          limit: 1000,
          hash: 0 as never,
        }, {
          maxRetryCount: 5,
          floodSleepThreshold: TELEGRAM_FLOOD_WAIT_MAX_MS,
        }),
        TELEGRAM_RPC_TIMEOUT_MS,
        'Timed out while fetching saved dialogs from Telegram.',
      )
      this.debug('sync.dialogs.done', {
        result_type: dialogsResponse._,
        dialog_count:
          'dialogs' in dialogsResponse && Array.isArray(dialogsResponse.dialogs)
            ? dialogsResponse.dialogs.length
            : 0,
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

        this.debug('sync.dialog_history.begin', {
          saved_peer_id: savedPeerId,
          title,
          top_message_id: dialog.topMessage ?? null,
        })
        const messages = await fetchSavedHistory(client, peerInput, lookup, this.options)
        this.debug('sync.dialog_history.done', {
          saved_peer_id: savedPeerId,
          title,
          message_count: messages.length,
        })
        const topMessage =
          messages.find((message) => message.message_id === dialog.topMessage) ??
          messages[messages.length - 1] ??
          null

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
      if (error instanceof TgsmError) {
        throw error
      }

      if (isTelegramAuthMissingError(error)) {
        throw new TgsmError({
          code: 'AUTH_REQUIRED',
          message: describeTelegramFailure(error, 'Telegram session is no longer valid.'),
          retryable: false,
          suggestion: 'Run `tgsm auth login` first.',
        })
      }

      this.debug('sync.failed', {
        message: describeTelegramFailure(error, 'Telegram sync failed.'),
      })
      throw new TgsmError({
        code: 'TELEGRAM_SYNC_FAILED',
        message: describeTelegramFailure(error, 'Telegram sync failed.'),
        retryable: true,
      })
    } finally {
      this.debug('sync.cleanup.begin')
      const cleanup = await destroyClientQuietly(client)
      this.debug('sync.cleanup.done', { status: cleanup })
    }
  }

  private debug(event: string, fields: Record<string, unknown> = {}): void {
    if (!this.options.debug) return
    this.options.logger?.(event, fields)
  }
}

function createTelegramClient(config: TelegramConfig, options: TelegramSourceOptions): TelegramClient {
  const client = new TelegramClient({
    apiId: config.apiId,
    apiHash: config.apiHash,
    crypto: new TgsmCryptoProvider(),
    storage: new MemoryStorage(),
    disableUpdates: true,
    logLevel: 0,
    network: {
      middlewares: networkMiddlewares.basic({
        floodWaiter: {
          maxWait: TELEGRAM_FLOOD_WAIT_MAX_MS,
          maxRetries: 5,
          onBeforeWait: (ctx, seconds) => {
            options.logger?.('telegram.flood_wait', {
              seconds,
              method: ctx.request._,
            })
          },
        },
      }),
    },
  })

  if (options.debug) {
    client.onConnectionState.add((state) => {
      options.logger?.('telegram.connection_state', { state })
    })
    client.onError.add((error) => {
      options.logger?.('telegram.client_error', {
        message: error.message,
        name: error.name,
      })
    })
  }

  return client
}

async function destroyClientQuietly(client: TelegramClient): Promise<'destroyed' | 'timed_out' | 'failed'> {
  try {
    await withTimeout(
      client.destroy(),
      TELEGRAM_DESTROY_TIMEOUT_MS,
      'Timed out while closing Telegram client.',
    )
    return 'destroyed'
  } catch (error) {
    if (error instanceof Error && error.message === 'Timed out while closing Telegram client.') {
      return 'timed_out'
    }
    return 'failed'
  }
}

async function ensureAuthenticatedUser(
  accountDir: string,
  client: TelegramClient,
  options: TelegramSourceOptions,
) {
  try {
    const me = await withTimeout(
      client.getMe(),
      TELEGRAM_CONNECT_TIMEOUT_MS,
      'Timed out while connecting to Telegram.',
    )
    await saveTelegramSession(accountDir, await client.exportSession())
    return me
  } catch (error) {
    if (isTelegramAuthInvalidError(error)) {
      options.logger?.('telegram.session_invalidated', {
        account_dir: accountDir,
        message: describeTelegramFailure(error, 'Telegram session is no longer valid.'),
      })
      await clearTelegramSession(accountDir)
    }

    throw error
  }
}

async function fetchSavedHistory(
  client: TelegramClient,
  peer: tl.TypeInputPeer,
  lookup: EntityLookup,
  options: TelegramSourceOptions,
): Promise<CacheMessageRecord[]> {
  let offsetId = 0
  let offsetDate = 0
  const records = new Map<string, CacheMessageRecord>()
  let pages = 0

  while (true) {
    pages += 1
    if (options.debug) {
      options.logger?.('sync.dialog_history.page.begin', {
        page: pages,
        offset_id: offsetId,
        offset_date: offsetDate,
      })
    }
    const history = await withTimeout(
      client.call({
        _: 'messages.getSavedHistory',
        peer,
        offsetId,
        offsetDate,
        addOffset: 0,
        limit: 100,
        maxId: 0,
        minId: 0,
        hash: 0 as never,
      }, {
        maxRetryCount: 5,
        floodSleepThreshold: TELEGRAM_FLOOD_WAIT_MAX_MS,
      }),
      TELEGRAM_RPC_TIMEOUT_MS,
      'Timed out while fetching saved history from Telegram.',
    )
    if (options.debug) {
      options.logger?.('sync.dialog_history.page.done', {
        page: pages,
        result_type: history._,
        message_count: 'messages' in history ? history.messages.length : 0,
      })
    }

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

export function normalizeRawMessage(raw: tl.RawMessage | tl.RawMessageService, lookup: EntityLookup): CacheMessageRecord {
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
    from_self:
      ('out' in raw ? Boolean(raw.out) : false) ||
      peerIsSelf('fromId' in raw ? raw.fromId : null, lookup.selfUserId) ||
      (savedPeerId === 'self' && !fwdFrom),
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
    const raw = await readFile(getTelegramConfigPath(accountPathOptions(accountDir)), 'utf8')
    return JSON.parse(raw) as TelegramConfig
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function saveTelegramConfig(accountDir: string, config: TelegramConfig): Promise<void> {
  await writeFile(
    getTelegramConfigPath(accountPathOptions(accountDir)),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  )
}

async function persistTelegramState(
  accountDir: string,
  client: TelegramClient,
  config: TelegramConfig,
): Promise<void> {
  await saveTelegramConfig(accountDir, config)
  await saveTelegramSession(accountDir, await client.exportSession())
}

async function restoreTelegramSession(
  accountDir: string,
  client: TelegramClient,
  options: TelegramSourceOptions,
): Promise<boolean> {
  const raw = await loadTelegramSessionRaw(accountDir)
  if (!raw) {
    return false
  }

  if (isLegacySqliteSession(raw)) {
    options.logger?.('telegram.session_legacy_sqlite_detected', {
      path: sessionPath(accountDir),
    })
    return false
  }

  const session = raw.toString('utf8').trim()
  if (!session) {
    return false
  }

  try {
    await client.importSession(session)
    return true
  } catch (error) {
    options.logger?.('telegram.session_import_failed', {
      message: describeTelegramFailure(error, 'Failed to import Telegram session.'),
    })
    return false
  }
}

async function loadTelegramSessionRaw(accountDir: string): Promise<Buffer | null> {
  try {
    return await readFile(sessionPath(accountDir))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function saveTelegramSession(accountDir: string, session: string): Promise<void> {
  await writeFile(sessionPath(accountDir), `${session.trim()}\n`, 'utf8')
  await Promise.all([
    rm(`${sessionPath(accountDir)}-wal`, { force: true }),
    rm(`${sessionPath(accountDir)}-shm`, { force: true }),
  ])
}

async function clearTelegramSession(accountDir: string): Promise<void> {
  await Promise.all([
    rm(sessionPath(accountDir), { force: true }),
    rm(`${sessionPath(accountDir)}-wal`, { force: true }),
    rm(`${sessionPath(accountDir)}-shm`, { force: true }),
  ])
}

function sessionPath(accountDir: string): string {
  return getTelegramSessionPath(accountPathOptions(accountDir))
}

function accountPathOptions(accountDir: string): { homeDir: string, account: string } {
  return {
    homeDir: path.dirname(accountDir),
    account: path.basename(accountDir),
  }
}

export function isLegacySqliteSession(raw: Buffer): boolean {
  return raw.subarray(0, SQLITE_FILE_HEADER.length).toString('utf8') === SQLITE_FILE_HEADER
}

export function describeTelegramFailure(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const message = [record.message, record.error, record.description]
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    if (message) {
      return message
    }

    try {
      const serialized = JSON.stringify(error)
      if (serialized && serialized !== '{}') {
        return serialized
      }
    } catch {
      // Ignore serialization failures and return the fallback message below.
    }
  }

  return fallback
}

export function isTelegramAuthInvalidError(error: unknown): boolean {
  return (
    tl.RpcError.is(error, 'AUTH_KEY_UNREGISTERED') ||
    tl.RpcError.is(error, 'SESSION_REVOKED') ||
    tl.RpcError.is(error, 'USER_DEACTIVATED') ||
    tl.RpcError.is(error, 'USER_DEACTIVATED_BAN')
  )
}

export function isTelegramAuthMissingError(error: unknown): boolean {
  return (
    isTelegramAuthInvalidError(error) ||
    tl.RpcError.is(error, 'SESSION_PASSWORD_NEEDED')
  )
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(message))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}
