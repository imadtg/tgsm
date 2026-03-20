import { readFile } from 'node:fs/promises'
import { TgsmError } from './errors'
import type { AuthStatus, SourceSnapshot, TgsmSourceAdapter } from './types'

interface FixtureFile {
  account?: SourceSnapshot['account']
  dialogs: SourceSnapshot['dialogs']
  messages: SourceSnapshot['messages']
}

export class FixtureSource implements TgsmSourceAdapter {
  readonly backend = 'fixture' as const

  constructor(private readonly fixturePath: string) {}

  async sync(): Promise<SourceSnapshot> {
    const raw = await readFile(this.fixturePath, 'utf8')
    const parsed = JSON.parse(raw) as FixtureFile

    if (!Array.isArray(parsed.dialogs) || !Array.isArray(parsed.messages)) {
      throw new TgsmError({
        code: 'INVALID_FIXTURE',
        message: `Fixture at ${this.fixturePath} is missing dialogs/messages arrays`,
        retryable: false,
      })
    }

    const syncedAt = new Date().toISOString()

    return {
      backend: this.backend,
      account:
        parsed.account ??
        ({
          id: 'fixture',
          display_name: 'Fixture Account',
        } as const),
      dialogs: parsed.dialogs.map((dialog) => ({
        ...dialog,
        last_synced_at: syncedAt,
      })),
      messages: parsed.messages,
      synced_at: syncedAt,
    }
  }

  async authStatus(): Promise<AuthStatus> {
    return {
      authenticated: true,
      user: {
        id: 'fixture',
        display_name: 'Fixture Account',
      },
    }
  }
}
