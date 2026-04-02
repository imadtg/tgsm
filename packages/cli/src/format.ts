import type {
  AuthStatus,
  MessageContextBundle,
  MessageInspectResult,
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

  const header = [
    'messages',
    `scope=${page.scope === 'saved_dialog' ? page.saved_peer_id : 'all_saved_dialogs'}`,
    `total=${page.result_count}`,
    `next=${page.next_cursor ?? '-'}`,
  ].join(' ')

  const blocks = page.items.map((item) =>
    [
      `msg ${item.saved_peer_id}:${item.message_id}`,
      `date=${item.date}`,
      `self=${toFlag(item.from_self)}`,
      `fwd=${toFlag(item.forwarded)}`,
      `reply=${item.reply_to_message_id ?? '-'}`,
      `kids=${item.direct_backreply_count}`,
      `text=${JSON.stringify(item.text_preview)}`,
    ].join(' '),
  )

  return [header, ...blocks].join('\n')
}

export function formatInspectResult(result: MessageInspectResult): string {
  const lines = [
    [
      `msg ${result.selector.resolved}`,
      `date=${result.target.date}`,
      `self=${toFlag(result.target.from_self)}`,
      `fwd=${toFlag(result.target.forwarded)}`,
      `reply=${result.target.reply.exists ? 1 : 0}`,
      `kids=${result.target.thread.direct_backreply_count}`,
      `desc=${result.target.thread.descendant_count_hint ?? 0}`,
      `media=${result.target.media_summary ?? '-'}`,
      `default_self=${toFlag(result.selector.defaulted_to_self)}`,
    ].join(' '),
    `txt ${JSON.stringify(result.target.text)}`,
  ]

  if (result.target.forward_origin) {
    lines.push(
      `origin ${formatRefLike({
        saved_peer_id: result.target.forward_origin.saved_peer_id ?? '-',
        message_id: result.target.forward_origin.message_id ?? 0,
        text_preview: result.target.forward_origin.title ?? '',
      }, result.target.forward_origin.message_id === null)}`,
    )
  }

  if (result.expansions.reply_parent) {
    lines.push(`reply ${formatMessageRef(result.expansions.reply_parent)}`)
  }

  if (result.expansions.chronology) {
    for (const item of result.expansions.chronology.before) {
      lines.push(`before ${formatMessageRef(item)}`)
    }
    for (const item of result.expansions.chronology.after) {
      lines.push(`after ${formatMessageRef(item)}`)
    }
  }

  if (result.expansions.backreplies) {
    for (const item of result.expansions.backreplies) {
      lines.push(`kid ${formatMessageRef(item)}`)
    }
  }

  if (result.expansions.thread) {
    lines.push(
      `thread root=${result.expansions.thread.root.saved_peer_id}:${result.expansions.thread.root.message_id} depth=${result.expansions.thread.depth_limit} truncated=${toFlag(result.expansions.thread.truncated)}`,
    )
    for (const node of result.expansions.thread.nodes) {
      renderThreadNode(node, lines)
    }
  }

  for (const note of result.notes) {
    lines.push(`note ${JSON.stringify(note)}`)
  }

  return lines.join('\n')
}

export function formatContextBundle(bundle: MessageContextBundle): string {
  const forwardOrigin = bundle.target.forward_origin
    ? [
        bundle.target.forward_origin.title,
        bundle.target.forward_origin.saved_peer_id,
        bundle.target.forward_origin.message_id !== null
          ? `#${bundle.target.forward_origin.message_id}`
          : null,
      ]
        .filter(Boolean)
        .join(' ')
    : null

  const lines: string[] = [
    `MESSAGE #${bundle.target.message_id}`,
    `dialog: ${bundle.dialog.saved_peer_id} (${bundle.dialog.title})`,
    `date: ${bundle.target.date}`,
    `from_self: ${bundle.target.from_self} forwarded: ${bundle.target.forwarded}`,
    ...(forwardOrigin ? [`origin: ${forwardOrigin}`] : []),
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

function renderThreadNode(
  node: NonNullable<MessageInspectResult['expansions']['thread']>['nodes'][number],
  lines: string[],
): void {
  lines.push(`thr depth=${node.depth} ${formatMessageRef(node.message)}`)
  node.children.forEach((child) => renderThreadNode(child, lines))
}

function formatMessageRef(
  ref: Pick<MessageListItem, 'message_id' | 'saved_peer_id' | 'text_preview'>,
): string {
  return formatRefLike(ref, false)
}

function formatRefLike(
  ref: { saved_peer_id: string, message_id: number, text_preview: string },
  omitMessageId: boolean,
): string {
  const selector = omitMessageId ? ref.saved_peer_id : `${ref.saved_peer_id}:${ref.message_id}`
  return `${selector} ${JSON.stringify(ref.text_preview)}`
}

function toFlag(value: boolean): 0 | 1 {
  return value ? 1 : 0
}
