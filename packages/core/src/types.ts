export type ReplyStatus = 'resolved' | 'missing' | 'not_fetched'

export interface SavedDialogSummary {
  saved_peer_id: string
  kind: 'self' | 'peer' | 'channel' | 'unknown'
  title: string
  top_message_id: number | null
  top_text_preview: string | null
  message_count: number
  pinned: boolean | null
  last_synced_at: string | null
}

export interface MessageRef {
  message_id: number
  saved_peer_id: string
  text_preview: string
  date: string
  relationship:
    | 'reply_to'
    | 'backreply'
    | 'chronology_before'
    | 'chronology_after'
    | 'thread_member'
}

export interface ReplyEdgeSummary {
  exists: boolean
  target: MessageRef | null
  status: ReplyStatus
}

export interface BackreplyEdgeSummary {
  message: MessageRef
  thread_depth_from_target: number
  subtree_size_hint: number | null
}

export interface ThreadDepthSummary {
  ancestors_known: number
  direct_backreply_count: number
  descendant_count_hint: number | null
  max_known_depth: number | null
}

export interface LinkSummary {
  url: string
  title?: string | null
}

export interface ForwardOriginSummary {
  saved_peer_id: string | null
  title: string | null
  message_id: number | null
}

export interface MessageEnvelope {
  message_id: number
  saved_peer_id: string
  date: string
  edit_date: string | null
  text: string
  text_preview: string
  from_self: boolean
  forwarded: boolean
  forward_origin: ForwardOriginSummary | null
  reply: ReplyEdgeSummary
  backreplies: BackreplyEdgeSummary[]
  thread: ThreadDepthSummary
  links: LinkSummary[]
  media_summary: string | null
  queued_for_delete: boolean
}

export interface ContextMessage {
  message: MessageEnvelope
  context_roles: Array<
    'target' | 'chronology_before' | 'chronology_after' | 'reply_parent' | 'backreply_child'
  >
}

export interface MessageContextBundle {
  target: MessageEnvelope
  dialog: SavedDialogSummary
  context_messages: ContextMessage[]
  window: {
    chronology_total_limit: number
    chronology_before_count: number
    chronology_after_count: number
    direct_reply_ancestor_included: boolean
    direct_backreply_count_included: number
  }
  notes: string[]
}

export type MessageInspectExpansion = 'chronology' | 'reply_parent' | 'backreplies' | 'thread'

export interface MessageSelectorResolution {
  input: string
  resolved: string
  defaulted_to_self: boolean
}

export interface MessageChronologyExpansion {
  before: MessageRef[]
  after: MessageRef[]
  before_count: number
  after_count: number
}

export interface MessageThreadNode {
  message: MessageRef
  depth: number
  children: MessageThreadNode[]
}

export interface MessageThreadExpansion {
  root: MessageRef
  depth_limit: number
  truncated: boolean
  nodes: MessageThreadNode[]
}

export interface MessageInspectResult {
  target: MessageEnvelope
  dialog: SavedDialogSummary
  selector: MessageSelectorResolution
  expansions: {
    chronology?: MessageChronologyExpansion
    reply_parent?: MessageRef | null
    backreplies?: MessageRef[]
    thread?: MessageThreadExpansion
  }
  notes: string[]
}

export interface MessageListItem {
  message_id: number
  saved_peer_id: string
  dialog_title: string
  date: string
  text_preview: string
  from_self: boolean
  forwarded: boolean
  reply_to_message_id: number | null
  direct_backreply_count: number
  queued_for_delete: boolean
}

export interface SearchResultPage<T = MessageListItem> {
  items: T[]
  scope: 'all_saved_dialogs' | 'saved_dialog'
  saved_peer_id: string | null
  next_cursor: string | null
  result_count: number
}

export interface ThreadInspectNode {
  message: MessageEnvelope
  depth: number
  children: ThreadInspectNode[]
}

export interface ThreadInspectResult {
  dialog: SavedDialogSummary
  root: MessageEnvelope
  nodes: ThreadInspectNode[]
}

export interface OperationErrorShape {
  code: string
  message: string
  retryable: boolean
  suggestion?: string
}

export interface AccountSummary {
  id: string
  display_name: string
}

export interface CacheMessageRecord {
  message_id: number
  saved_peer_id: string
  date: string
  edit_date: string | null
  text: string
  from_self: boolean
  forwarded: boolean
  forward_origin: ForwardOriginSummary | null
  reply_to_message_id: number | null
  reply_to_saved_peer_id: string | null
  links: LinkSummary[]
  media_summary: string | null
  queued_for_delete: boolean
}

export interface CacheState {
  version: 1
  backend: 'telegram' | 'fixture'
  account: AccountSummary | null
  synced_at: string | null
  dialogs: SavedDialogSummary[]
  messages: CacheMessageRecord[]
}

export interface SourceSnapshot {
  backend: 'telegram' | 'fixture'
  account: AccountSummary | null
  dialogs: SavedDialogSummary[]
  messages: CacheMessageRecord[]
  synced_at: string
}

export interface SyncResult {
  backend: 'telegram' | 'fixture'
  synced_at: string
  synced_dialogs: number
  synced_messages: number
}

export interface AuthStatus {
  authenticated: boolean
  user: AccountSummary | null
}

export interface TelegramLoginInput {
  apiId: number
  apiHash: string
  phone: string
  code?: string
  password?: string
}

export interface ListMessagesOptions {
  dialog?: string
  search?: string
  limit?: number
  cursor?: string | null
}

export interface GetMessageOptions {
  dialog?: string
  with?: MessageInspectExpansion[]
  before?: number
  after?: number
  thread_depth?: number
}

export interface TgsmSourceAdapter {
  readonly backend: 'telegram' | 'fixture'
  sync(accountDir: string): Promise<SourceSnapshot>
  authLogin?(accountDir: string, input: TelegramLoginInput): Promise<AuthStatus>
  authStatus?(accountDir: string): Promise<AuthStatus>
}
