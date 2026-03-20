import os from 'node:os'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'

export interface PathOptions {
  homeDir?: string
  account?: string
}

export function getHomeDir(homeDir?: string): string {
  return homeDir ?? process.env.TGSM_HOME ?? path.join(os.homedir(), '.tgsm')
}

export function getAccountName(account?: string): string {
  return account ?? 'default'
}

export function getAccountDir(options: PathOptions = {}): string {
  return path.join(getHomeDir(options.homeDir), getAccountName(options.account))
}

export function getCachePath(options: PathOptions = {}): string {
  return path.join(getAccountDir(options), 'cache.json')
}

export function getTelegramConfigPath(options: PathOptions = {}): string {
  return path.join(getAccountDir(options), 'telegram.json')
}

export function getTelegramSessionPath(options: PathOptions = {}): string {
  return path.join(getAccountDir(options), 'mtcute-session')
}

export async function ensureAccountDir(options: PathOptions = {}): Promise<string> {
  const accountDir = getAccountDir(options)
  await mkdir(accountDir, { recursive: true })
  return accountDir
}
