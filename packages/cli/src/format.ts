import type {
  AuthStatus,
  MessageContextBundle,
  MessageListItem,
  SavedDialogSummary,
  SearchResultPage,
  SyncResult,
  ThreadInspectNode,
  ThreadInspectResult,
} from '@tgsm/core'

export function formatSyncResult(result: SyncResult): string {
  return [
    `sync backend=${result.backend}`,
    `synced_at=${result.synced_at}`,
    `dialogs=${result.synced_dialogs}`,
    `messages=${result.synced_messages}`,
  ].join('\n')
}

export function formatAuthStatus(status: AuthStatus): string {
  if (!status.authenticated || !status.user) {
    return 'authenticated: false'
  }

  return [`authenticated: true`, `user: ${status.user.display_name}`, `id: ${status.user.id}`].join('\n')
}

export function formatSavedDialogs(dialogs: SavedDialogSummary[]): string {
  if (dialogs.length === 0) return 'No saved dialogs found.'

  return dialogs
    .map((dialog) =>
      [
        `${dialog.saved_peer_id} (${dialog.kind})`,
        `title: ${dialog.title}`,
        `messages: ${dialog.message_count}`,
        `top_message_id: ${dialog.top_message_id ?? 'n/a'}`,
        `top_text: ${dialog.top_text_preview ?? '(none)'}`,
      ].join('\n'),
    )
    .join('\n\n')
}

export function formatMessagesPage(page: SearchResultPage<MessageListItem>): string {
  if (page.items.length === 0) return 'No messages found.'

  const header =
    page.scope === 'saved_dialog'
      ? `messages scope=${page.saved_peer_id} total=${page.result_count}`
      : `messages scope=all_saved_dialogs total=${page.result_count}`

  const blocks = page.items.map((item) =>
    [
      `#${item.message_id} ${item.date}`,
      `dialog: ${item.saved_peer_id} (${item.dialog_title})`,
      `from_self: ${item.from_self} forwarded: ${item.forwarded}`,
      `reply_to: ${item.reply_to_message_id ?? 'none'} backreplies: ${item.direct_backreply_count}`,
      `text: ${item.text_preview}`,
    ].join('\n'),
  )

  return [header, ...blocks, page.next_cursor ? `next_cursor: ${page.next_cursor}` : ''].filter(Boolean).join('\n\n')
}

export function formatContextBundle(bundle: MessageContextBundle): string {
  const lines: string[] = [
    `MESSAGE #${bundle.target.message_id}`,
    `dialog: ${bundle.dialog.saved_peer_id} (${bundle.dialog.title})`,
    `date: ${bundle.target.date}`,
    `from_self: ${bundle.target.from_self}`,
    `thread: direct_backreplies=${bundle.target.thread.direct_backreply_count} descendant_hint=${bundle.target.thread.descendant_count_hint ?? 0}`,
    '',
    'text:',
    bundle.target.text || '(no text)',
  ]

  const replySection = bundle.target.reply.exists
    ? bundle.target.reply.target
      ? [``, 'reply_to:', `- #${bundle.target.reply.target.message_id} ${bundle.target.reply.target.text_preview}`]
      : [``, 'reply_to:', '- (missing from cache)']
    : []

  const backreplySection =
    bundle.target.backreplies.length > 0
      ? [
          '',
          'backreplies:',
          ...bundle.target.backreplies.map(
            (item) => `- #${item.message.message_id} ${item.message.text_preview}`,
          ),
        ]
      : []

  const before = bundle.context_messages.filter((item) => item.context_roles.includes('chronology_before'))
  const after = bundle.context_messages.filter((item) => item.context_roles.includes('chronology_after'))

  if (before.length > 0) {
    lines.push('', 'chronology_before:')
    for (const item of before) lines.push(`- #${item.message.message_id} ${item.message.text_preview}`)
  }

  if (after.length > 0) {
    lines.push('', 'chronology_after:')
    for (const item of after) lines.push(`- #${item.message.message_id} ${item.message.text_preview}`)
  }

  lines.push(...replySection, ...backreplySection)

  if (bundle.notes.length > 0) {
    lines.push('', 'notes:')
    for (const note of bundle.notes) lines.push(`- ${note}`)
  }

  return lines.join('\n')
}

export function formatThread(result: ThreadInspectResult): string {
  const lines = [`THREAD #${result.root.message_id}`, `dialog: ${result.dialog.saved_peer_id} (${result.dialog.title})`, '']

  const root = result.nodes[0]
  if (!root) return lines.join('\n')

  renderNode(root, '', true, lines)
  return lines.join('\n')
}

function renderNode(node: ThreadInspectNode, prefix: string, isLast: boolean, lines: string[]): void {
  const branch = prefix ? `${prefix}${isLast ? '└── ' : '├── '}` : ''
  lines.push(`${branch}#${node.message.message_id} ${node.message.text_preview}`)

  const nextPrefix = prefix ? `${prefix}${isLast ? '    ' : '│   '}` : ''
  node.children.forEach((child, index) => {
    renderNode(child, nextPrefix, index === node.children.length - 1, lines)
  })
}
