import { readFile, writeFile } from 'node:fs/promises'
import type { CacheState, SourceSnapshot } from './types'

export const EMPTY_CACHE: CacheState = {
  version: 1,
  backend: 'fixture',
  account: null,
  synced_at: null,
  dialogs: [],
  messages: [],
}

export async function readCache(cachePath: string): Promise<CacheState> {
  try {
    const raw = await readFile(cachePath, 'utf8')
    return JSON.parse(raw) as CacheState
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return EMPTY_CACHE
    }

    throw error
  }
}

export async function writeCache(cachePath: string, snapshot: SourceSnapshot): Promise<void> {
  const state: CacheState = {
    version: 1,
    backend: snapshot.backend,
    account: snapshot.account,
    synced_at: snapshot.synced_at,
    dialogs: snapshot.dialogs,
    messages: snapshot.messages,
  }

  await writeFile(cachePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}
