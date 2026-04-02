import path from 'node:path'
import { readCache, writeCache } from './cache'
import { TgsmError } from './errors'
import type {
  BackreplyEdgeSummary,
  CacheMessageRecord,
  CacheState,
  ContextMessage,
  GetMessageOptions,
  MessageInspectExpansion,
  MessageInspectResult,
  MessageThreadNode,
  ListMessagesOptions,
  MessageContextBundle,
  MessageEnvelope,
  MessageListItem,
  MessageRef,
  SavedDialogSummary,
  SearchResultPage,
  SyncResult,
  ThreadInspectNode,
  ThreadInspectResult,
  TgsmSourceAdapter,
} from './types'

export interface TgsmServiceOptions {
  cachePath: string
  source?: TgsmSourceAdapter
}

interface Indexes {
  dialogsById: Map<string, SavedDialogSummary>
  messagesByKey: Map<string, CacheMessageRecord>
  messagesByGlobalId: Map<number, CacheMessageRecord[]>
  messagesByDialog: Map<string, CacheMessageRecord[]>
  backreplyIndex: Map<string, CacheMessageRecord[]>
}

const DEFAULT_CHRONOLOGY_LIMIT = 20
const DEFAULT_INSPECT_BEFORE = 5
const DEFAULT_INSPECT_AFTER = 5
const DEFAULT_THREAD_DEPTH = 1

export class TgsmService {
  constructor(private readonly options: TgsmServiceOptions) {}

  async authLogin(input: Parameters<NonNullable<TgsmSourceAdapter['authLogin']>>[1]) {
    if (!this.options.source?.authLogin) {
      throw new TgsmError({
        code: 'AUTH_UNSUPPORTED',
        message: 'This backend does not support auth login.',
        retryable: false,
      })
    }

    return this.options.source.authLogin(this.accountDir(), input)
  }

  async authStatus() {
    if (!this.options.source?.authStatus) {
      return {
        authenticated: false,
        user: null,
      }
    }

    return this.options.source.authStatus(this.accountDir())
  }

  async sync(): Promise<SyncResult> {
    if (!this.options.source) {
      throw new TgsmError({
        code: 'SYNC_UNAVAILABLE',
        message: 'No source backend configured for sync.',
        retryable: false,
      })
    }

    const snapshot = await this.options.source.sync(this.accountDir())
    await writeCache(this.options.cachePath, snapshot)

    return {
      backend: snapshot.backend,
      synced_at: snapshot.synced_at,
      synced_dialogs: snapshot.dialogs.length,
      synced_messages: snapshot.messages.length,
    }
  }

  async listSavedDialogs(): Promise<SavedDialogSummary[]> {
    const cache = await this.loadCache()
    return [...cache.dialogs].sort((a, b) => {
      const left = a.last_synced_at ?? ''
      const right = b.last_synced_at ?? ''
      return right.localeCompare(left) || a.saved_peer_id.localeCompare(b.saved_peer_id)
    })
  }

  async listMessages(options: ListMessagesOptions = {}): Promise<SearchResultPage<MessageListItem>> {
    const cache = await this.loadCache()
    const indexes = this.buildIndexes(cache)
    const dialogId = options.dialog ?? null

    if (dialogId && !indexes.dialogsById.has(dialogId)) {
      throw new TgsmError({
        code: 'DIALOG_NOT_FOUND',
        message: `Saved dialog ${dialogId} was not found.`,
        retryable: false,
        suggestion: 'Run `tgsm messages list --json` to inspect available saved peer ids.',
      })
    }

    const scoped = dialogId
      ? indexes.messagesByDialog.get(dialogId) ?? []
      : cache.messages

    const filtered = options.search
      ? scoped.filter((message: CacheMessageRecord) => matchesSearch(message, options.search!))
      : scoped

    const sorted = [...filtered].sort(compareByDateDesc)
    const limit = Math.max(1, options.limit ?? 20)
    const offset = decodeCursor(options.cursor)
    const slice = sorted.slice(offset, offset + limit)

    return {
      items: slice.map((message) => this.toMessageListItem(message, indexes)),
      scope: dialogId ? 'saved_dialog' : 'all_saved_dialogs',
      saved_peer_id: dialogId,
      next_cursor: offset + limit < sorted.length ? encodeCursor(offset + limit) : null,
      result_count: filtered.length,
    }
  }

  async getMessage(messageId: number, options: GetMessageOptions = {}): Promise<MessageContextBundle> {
    const cache = await this.loadCache()
    const indexes = this.buildIndexes(cache)
    const target = this.findMessage(indexes, messageId, options.dialog)
    return this.buildContextBundle(target, indexes)
  }

  async getContext(messageId: number, options: GetMessageOptions = {}): Promise<MessageContextBundle> {
    return this.getMessage(messageId, options)
  }

  async inspectMessage(
    input: string | number,
    options: GetMessageOptions = {},
  ): Promise<MessageInspectResult> {
    const cache = await this.loadCache()
    const indexes = this.buildIndexes(cache)
    const resolved = this.resolveMessageTarget(indexes, input)
    const target = resolved.message
    const dialog = indexes.dialogsById.get(target.saved_peer_id)

    if (!dialog) {
      throw new TgsmError({
        code: 'DIALOG_NOT_FOUND',
        message: `Saved dialog ${target.saved_peer_id} was not found.`,
        retryable: false,
      })
    }

    const requested = normalizeInspectExpansions(options.with)
    const notes: string[] = []
    const expansions: MessageInspectResult['expansions'] = {}

    const replyTarget =
      target.reply_to_message_id !== null
        ? indexes.messagesByKey.get(
            makeMessageKey(target.reply_to_saved_peer_id ?? target.saved_peer_id, target.reply_to_message_id),
          ) ?? null
        : null

    if (target.reply_to_message_id !== null && !replyTarget) {
      notes.push(`Reply target #${target.reply_to_message_id} could not be resolved in cache.`)
    }

    if (requested.has('chronology')) {
      const chronological = indexes.messagesByDialog.get(target.saved_peer_id) ?? []
      const targetIndex = chronological.findIndex(
        (message) => message.message_id === target.message_id && message.saved_peer_id === target.saved_peer_id,
      )
      const beforeLimit = normalizePositiveInt(options.before, DEFAULT_INSPECT_BEFORE)
      const afterLimit = normalizePositiveInt(options.after, DEFAULT_INSPECT_AFTER)
      const before = chronological.slice(Math.max(0, targetIndex - beforeLimit), targetIndex)
      const after = chronological.slice(targetIndex + 1, targetIndex + 1 + afterLimit)

      expansions.chronology = {
        before: before.map((message) => this.toMessageRef(message, 'chronology_before')),
        after: after.map((message) => this.toMessageRef(message, 'chronology_after')),
        before_count: before.length,
        after_count: after.length,
      }
    }

    if (requested.has('reply_parent')) {
      expansions.reply_parent =
        target.reply_to_message_id === null
          ? null
          : replyTarget
            ? this.toMessageRef(replyTarget, 'reply_to')
            : {
                message_id: target.reply_to_message_id,
                saved_peer_id: target.reply_to_saved_peer_id ?? target.saved_peer_id,
                text_preview: '(missing from cache)',
                date: '',
                relationship: 'reply_to',
              }
    }

    if (requested.has('backreplies')) {
      const directBackreplies =
        indexes.backreplyIndex.get(makeMessageKey(target.saved_peer_id, target.message_id)) ?? []
      expansions.backreplies = directBackreplies.map((message) => this.toMessageRef(message, 'backreply'))
    }

    if (requested.has('thread')) {
      const depthLimit = normalizeNonNegativeInt(options.thread_depth, DEFAULT_THREAD_DEPTH)
      expansions.thread = this.buildLimitedThreadExpansion(target, indexes, depthLimit)
    }

    return {
      target: this.toEnvelope(target, indexes),
      dialog,
      selector: {
        input: String(input),
        resolved: makeMessageKey(target.saved_peer_id, target.message_id),
        defaulted_to_self: resolved.defaultedToSelf,
      },
      expansions,
      notes,
    }
  }

  async inspectThread(messageId: number, options: GetMessageOptions = {}): Promise<ThreadInspectResult> {
    const cache = await this.loadCache()
    const indexes = this.buildIndexes(cache)
    const target = this.findMessage(indexes, messageId, options.dialog)
    const root = this.findThreadRoot(target, indexes)
    const dialog = indexes.dialogsById.get(root.saved_peer_id)

    if (!dialog) {
      throw new TgsmError({
        code: 'DIALOG_NOT_FOUND',
        message: `Saved dialog ${root.saved_peer_id} was not found.`,
        retryable: false,
      })
    }

    return {
      dialog,
      root: this.toEnvelope(root, indexes),
      nodes: [this.buildThreadNode(root, indexes, 0)],
    }
  }

  private accountDir(): string {
    return path.dirname(this.options.cachePath)
  }

  private async loadCache(): Promise<CacheState> {
    return readCache(this.options.cachePath)
  }

  private buildIndexes(cache: CacheState): Indexes {
    const dialogsById = new Map<string, SavedDialogSummary>(
      cache.dialogs.map((dialog: SavedDialogSummary) => [dialog.saved_peer_id, dialog]),
    )
    const messagesByKey = new Map<string, CacheMessageRecord>()
    const messagesByGlobalId = new Map<number, CacheMessageRecord[]>()
    const messagesByDialog = new Map<string, CacheMessageRecord[]>()
    const backreplyIndex = new Map<string, CacheMessageRecord[]>()

    for (const message of cache.messages) {
      messagesByKey.set(makeMessageKey(message.saved_peer_id, message.message_id), message)

      const existingGlobal = messagesByGlobalId.get(message.message_id) ?? []
      existingGlobal.push(message)
      messagesByGlobalId.set(message.message_id, existingGlobal)

      const dialogMessages = messagesByDialog.get(message.saved_peer_id) ?? []
      dialogMessages.push(message)
      messagesByDialog.set(message.saved_peer_id, dialogMessages)

      if (message.reply_to_message_id !== null) {
        const replyDialog = message.reply_to_saved_peer_id ?? message.saved_peer_id
        const key = makeMessageKey(replyDialog, message.reply_to_message_id)
        const children = backreplyIndex.get(key) ?? []
        children.push(message)
        backreplyIndex.set(key, children)
      }
    }

    for (const records of messagesByDialog.values()) {
      records.sort(compareByDateAsc)
    }

    for (const records of backreplyIndex.values()) {
      records.sort(compareByDateAsc)
    }

    return {
      dialogsById,
      messagesByKey,
      messagesByGlobalId,
      messagesByDialog,
      backreplyIndex,
    }
  }

  private findMessage(indexes: Indexes, messageId: number, dialog?: string): CacheMessageRecord {
    if (dialog) {
      const scoped = indexes.messagesByKey.get(makeMessageKey(dialog, messageId))
      if (!scoped) {
        throw new TgsmError({
          code: 'MESSAGE_NOT_FOUND',
          message: `Message ${messageId} was not found in dialog ${dialog}.`,
          retryable: false,
          suggestion: 'Run `tgsm messages list --dialog <saved_peer_id>` to inspect that scope.',
        })
      }
      return scoped
    }

    const candidates = indexes.messagesByGlobalId.get(messageId) ?? []

    if (candidates.length === 0) {
      throw new TgsmError({
        code: 'MESSAGE_NOT_FOUND',
        message: `Message ${messageId} was not found in the selected scope.`,
        retryable: false,
        suggestion: 'Run `tgsm messages list` or narrow the dialog scope.',
      })
    }

    if (candidates.length > 1) {
      throw new TgsmError({
        code: 'AMBIGUOUS_MESSAGE_ID',
        message: `Message ID ${messageId} exists in multiple saved dialogs.`,
        retryable: false,
        suggestion: 'Pass `--dialog <saved_peer_id>` to disambiguate.',
      })
    }

    return candidates[0]!
  }

  private resolveMessageTarget(
    indexes: Indexes,
    input: string | number,
  ): { message: CacheMessageRecord, defaultedToSelf: boolean } {
    if (typeof input === 'number') {
      return this.resolveMessageTarget(indexes, String(input))
    }

    const trimmed = input.trim()
    const explicit = parseExplicitSelector(trimmed)
    if (explicit) {
      return {
        message: this.findMessage(indexes, explicit.messageId, explicit.savedPeerId),
        defaultedToSelf: false,
      }
    }

    const numericId = Number(trimmed)
    if (!Number.isInteger(numericId) || numericId < 1) {
      throw new TgsmError({
        code: 'INVALID_MESSAGE_SELECTOR',
        message: `Message selector ${JSON.stringify(input)} is invalid.`,
        retryable: false,
        suggestion: 'Use `<message_id>` or `<saved_peer_id>:<message_id>`.',
      })
    }

    const selfScoped = indexes.messagesByKey.get(makeMessageKey('self', numericId))
    if (selfScoped) {
      return {
        message: selfScoped,
        defaultedToSelf: true,
      }
    }

    const candidates = indexes.messagesByGlobalId.get(numericId) ?? []
    if (candidates.length === 1) {
      return {
        message: candidates[0]!,
        defaultedToSelf: false,
      }
    }

    if (candidates.length > 1) {
      throw new TgsmError({
        code: 'AMBIGUOUS_MESSAGE_ID',
        message: `Message ID ${numericId} exists in multiple saved dialogs.`,
        retryable: false,
        suggestion: 'Pass `<saved_peer_id>:<message_id>` to disambiguate.',
      })
    }

    throw new TgsmError({
      code: 'MESSAGE_NOT_FOUND',
      message: `Message ${numericId} was not found in the selected scope.`,
      retryable: false,
      suggestion: 'Run `tgsm messages list` or pass an explicit `<saved_peer_id>:<message_id>` selector.',
    })
  }

  private buildContextBundle(target: CacheMessageRecord, indexes: Indexes): MessageContextBundle {
    const dialog = indexes.dialogsById.get(target.saved_peer_id)

    if (!dialog) {
      throw new TgsmError({
        code: 'DIALOG_NOT_FOUND',
        message: `Saved dialog ${target.saved_peer_id} was not found.`,
        retryable: false,
      })
    }

    const chronological = indexes.messagesByDialog.get(target.saved_peer_id) ?? []
    const targetIndex = chronological.findIndex(
      (message) => message.message_id === target.message_id && message.saved_peer_id === target.saved_peer_id,
    )

    const maxEachSide = Math.floor(DEFAULT_CHRONOLOGY_LIMIT / 2)
    const before = chronological.slice(Math.max(0, targetIndex - maxEachSide), targetIndex)
    const after = chronological.slice(targetIndex + 1, targetIndex + 1 + maxEachSide)

    const replyParent = target.reply_to_message_id
      ? indexes.messagesByKey.get(
          makeMessageKey(target.reply_to_saved_peer_id ?? target.saved_peer_id, target.reply_to_message_id),
        ) ?? null
      : null

    const directBackreplies =
      indexes.backreplyIndex.get(makeMessageKey(target.saved_peer_id, target.message_id)) ?? []

    const notes: string[] = []
    if (target.reply_to_message_id !== null && !replyParent) {
      notes.push(`Reply target #${target.reply_to_message_id} could not be resolved in cache.`)
    }

    const contexts = new Map<string, ContextMessage>()
    const pushContext = (
      message: CacheMessageRecord,
      role: ContextMessage['context_roles'][number],
    ): void => {
      const key = makeMessageKey(message.saved_peer_id, message.message_id)
      const existing = contexts.get(key)
      if (existing) {
        if (!existing.context_roles.includes(role)) {
          existing.context_roles.push(role)
        }
        return
      }

      contexts.set(key, {
        message: this.toEnvelope(message, indexes),
        context_roles: [role],
      })
    }

    for (const message of before) pushContext(message, 'chronology_before')
    if (replyParent) pushContext(replyParent, 'reply_parent')
    pushContext(target, 'target')
    for (const message of directBackreplies) pushContext(message, 'backreply_child')
    for (const message of after) pushContext(message, 'chronology_after')

    const contextMessages = [...contexts.values()].sort((left, right) => {
      const rank = (roles: ContextMessage['context_roles']): number => {
        if (roles.includes('chronology_before')) return 1
        if (roles.includes('reply_parent')) return 2
        if (roles.includes('target')) return 3
        if (roles.includes('backreply_child')) return 4
        return 5
      }

      return (
        rank(left.context_roles) - rank(right.context_roles) ||
        left.message.date.localeCompare(right.message.date) ||
        left.message.message_id - right.message.message_id
      )
    })

    return {
      target: this.toEnvelope(target, indexes),
      dialog,
      context_messages: contextMessages,
      window: {
        chronology_total_limit: DEFAULT_CHRONOLOGY_LIMIT,
        chronology_before_count: before.length,
        chronology_after_count: after.length,
        direct_reply_ancestor_included: Boolean(replyParent),
        direct_backreply_count_included: directBackreplies.length,
      },
      notes,
    }
  }

  private toMessageListItem(message: CacheMessageRecord, indexes: Indexes): MessageListItem {
    const dialog = indexes.dialogsById.get(message.saved_peer_id)
    const directBackreplyCount =
      indexes.backreplyIndex.get(makeMessageKey(message.saved_peer_id, message.message_id))?.length ?? 0

    return {
      message_id: message.message_id,
      saved_peer_id: message.saved_peer_id,
      dialog_title: dialog?.title ?? message.saved_peer_id,
      date: message.date,
      text_preview: previewText(message.text),
      from_self: message.from_self,
      forwarded: message.forwarded,
      reply_to_message_id: message.reply_to_message_id,
      direct_backreply_count: directBackreplyCount,
      queued_for_delete: message.queued_for_delete,
    }
  }

  private toEnvelope(message: CacheMessageRecord, indexes: Indexes): MessageEnvelope {
    const replyTarget =
      message.reply_to_message_id !== null
        ? indexes.messagesByKey.get(
            makeMessageKey(message.reply_to_saved_peer_id ?? message.saved_peer_id, message.reply_to_message_id),
          ) ?? null
        : null

    const directBackreplies =
      indexes.backreplyIndex.get(makeMessageKey(message.saved_peer_id, message.message_id)) ?? []

    const reply: MessageEnvelope['reply'] =
      message.reply_to_message_id === null
        ? {
            exists: false,
            target: null,
            status: 'resolved',
          }
        : {
            exists: true,
            target: replyTarget
              ? this.toMessageRef(replyTarget, 'reply_to')
              : {
                  message_id: message.reply_to_message_id,
                  saved_peer_id: message.reply_to_saved_peer_id ?? message.saved_peer_id,
                  text_preview: '(missing from cache)',
                  date: '',
                  relationship: 'reply_to',
                },
            status: replyTarget ? 'resolved' : 'missing',
          }

    const backreplies: BackreplyEdgeSummary[] = directBackreplies.map((child) => ({
      message: this.toMessageRef(child, 'backreply'),
      thread_depth_from_target: 1,
      subtree_size_hint: this.countDescendants(child, indexes),
    }))

    return {
      message_id: message.message_id,
      saved_peer_id: message.saved_peer_id,
      date: message.date,
      edit_date: message.edit_date,
      text: message.text,
      text_preview: previewText(message.text),
      from_self: message.from_self,
      forwarded: message.forwarded,
      forward_origin: message.forward_origin,
      reply,
      backreplies,
      thread: {
        ancestors_known: this.countAncestors(message, indexes),
        direct_backreply_count: backreplies.length,
        descendant_count_hint: this.countDescendants(message, indexes),
        max_known_depth: this.maxDepth(message, indexes),
      },
      links: message.links,
      media_summary: message.media_summary,
      queued_for_delete: message.queued_for_delete,
    }
  }

  private toMessageRef(
    message: CacheMessageRecord,
    relationship: MessageRef['relationship'],
  ): MessageRef {
    return {
      message_id: message.message_id,
      saved_peer_id: message.saved_peer_id,
      text_preview: previewText(message.text),
      date: message.date,
      relationship,
    }
  }

  private findThreadRoot(message: CacheMessageRecord, indexes: Indexes): CacheMessageRecord {
    let current = message

    while (current.reply_to_message_id !== null) {
      const parent = indexes.messagesByKey.get(
        makeMessageKey(current.reply_to_saved_peer_id ?? current.saved_peer_id, current.reply_to_message_id),
      )
      if (!parent || parent.saved_peer_id !== current.saved_peer_id) {
        break
      }
      current = parent
    }

    return current
  }

  private buildThreadNode(
    message: CacheMessageRecord,
    indexes: Indexes,
    depth: number,
  ): ThreadInspectNode {
    const children =
      indexes.backreplyIndex.get(makeMessageKey(message.saved_peer_id, message.message_id)) ?? []

    return {
      message: this.toEnvelope(message, indexes),
      depth,
      children: children.map((child) => this.buildThreadNode(child, indexes, depth + 1)),
    }
  }

  private buildLimitedThreadExpansion(
    message: CacheMessageRecord,
    indexes: Indexes,
    depthLimit: number,
  ): MessageInspectResult['expansions']['thread'] {
    const root = this.findThreadRoot(message, indexes)
    const built = this.buildLimitedThreadNode(root, indexes, 0, depthLimit)

    return {
      root: this.toMessageRef(root, 'thread_member'),
      depth_limit: depthLimit,
      truncated: built.truncated,
      nodes: [built.node],
    }
  }

  private buildLimitedThreadNode(
    message: CacheMessageRecord,
    indexes: Indexes,
    depth: number,
    depthLimit: number,
  ): { node: MessageThreadNode, truncated: boolean } {
    const children =
      indexes.backreplyIndex.get(makeMessageKey(message.saved_peer_id, message.message_id)) ?? []

    if (depth >= depthLimit) {
      return {
        node: {
          message: this.toMessageRef(message, 'thread_member'),
          depth,
          children: [],
        },
        truncated: children.length > 0,
      }
    }

    let truncated = false
    const builtChildren = children.map((child) => {
      const built = this.buildLimitedThreadNode(child, indexes, depth + 1, depthLimit)
      truncated ||= built.truncated
      return built.node
    })

    return {
      node: {
        message: this.toMessageRef(message, 'thread_member'),
        depth,
        children: builtChildren,
      },
      truncated,
    }
  }

  private countAncestors(message: CacheMessageRecord, indexes: Indexes): number {
    let count = 0
    let current = message

    while (current.reply_to_message_id !== null) {
      const parent = indexes.messagesByKey.get(
        makeMessageKey(current.reply_to_saved_peer_id ?? current.saved_peer_id, current.reply_to_message_id),
      )
      if (!parent) break
      count += 1
      current = parent
    }

    return count
  }

  private countDescendants(message: CacheMessageRecord, indexes: Indexes): number {
    const children =
      indexes.backreplyIndex.get(makeMessageKey(message.saved_peer_id, message.message_id)) ?? []

    return children.reduce((count, child) => count + 1 + this.countDescendants(child, indexes), 0)
  }

  private maxDepth(message: CacheMessageRecord, indexes: Indexes): number {
    const children =
      indexes.backreplyIndex.get(makeMessageKey(message.saved_peer_id, message.message_id)) ?? []
    if (children.length === 0) return 0
    return 1 + Math.max(...children.map((child) => this.maxDepth(child, indexes)))
  }
}

function makeMessageKey(savedPeerId: string, messageId: number): string {
  return `${savedPeerId}:${messageId}`
}

function parseExplicitSelector(
  input: string,
): { savedPeerId: string, messageId: number } | null {
  const match = /^(.*):(\d+)$/.exec(input)
  if (!match) return null

  const savedPeerId = match[1]?.trim()
  const messageId = Number(match[2])
  if (!savedPeerId || !Number.isInteger(messageId) || messageId < 1) {
    return null
  }

  return { savedPeerId, messageId }
}

function normalizeInspectExpansions(
  requested: MessageInspectExpansion[] | undefined,
): Set<MessageInspectExpansion> {
  return new Set(requested ?? [])
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !value || value < 1) return fallback
  return Math.floor(value)
}

function normalizeNonNegativeInt(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined || value < 0) return fallback
  return Math.floor(value)
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url')
}

function decodeCursor(cursor?: string | null): number {
  if (!cursor) return 0

  try {
    const value = Number(Buffer.from(cursor, 'base64url').toString('utf8'))
    return Number.isFinite(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

function compareByDateAsc(left: CacheMessageRecord, right: CacheMessageRecord): number {
  return left.date.localeCompare(right.date) || left.message_id - right.message_id
}

function compareByDateDesc(left: CacheMessageRecord, right: CacheMessageRecord): number {
  return right.date.localeCompare(left.date) || right.message_id - left.message_id
}

function matchesSearch(message: CacheMessageRecord, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  return [
    message.text,
    message.forward_origin?.title ?? '',
    message.saved_peer_id,
  ]
    .join('\n')
    .toLowerCase()
    .includes(normalized)
}

function previewText(text: string, limit = 80): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return '(no text)'
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`
}
