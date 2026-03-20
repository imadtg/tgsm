import { createInterface } from 'node:readline/promises'
import process from 'node:process'
import { Command } from 'commander'
import {
  FixtureSource,
  TgsmError,
  TgsmService,
  TelegramSource,
  ensureAccountDir,
  getCachePath,
  type GetMessageOptions,
  type ListMessagesOptions,
  type TgsmSourceAdapter,
} from '@tgsm/core'
import {
  formatAuthStatus,
  formatContextBundle,
  formatMessagesPage,
  formatSavedDialogs,
  formatSyncResult,
  formatThread,
} from './format'

interface GlobalOptions {
  json?: boolean
  backend?: 'telegram' | 'fixture'
  fixture?: string
  home?: string
  account?: string
}

const program = new Command()

program
  .name('tgsm')
  .description('Retrieval-first Telegram Saved Messages CLI')
  .option('--json', 'Emit JSON instead of default text output')
  .option('--backend <backend>', 'telegram or fixture', 'telegram')
  .option('--fixture <path>', 'Fixture path for the fixture backend')
  .option('--home <path>', 'Override TGSM home directory')
  .option('--account <name>', 'Account namespace', 'default')

program
  .command('auth')
  .description('Telegram auth commands')
  .addCommand(
    new Command('login').action(async (_, command) => {
      await withService(command.optsWithGlobals(), async (service, options) => {
        if (options.backend !== 'telegram') {
          throw new TgsmError({
            code: 'AUTH_UNSUPPORTED',
            message: 'Auth login is only supported with the telegram backend.',
            retryable: false,
          })
        }

        const rl = createInterface({
          input: process.stdin,
          output: process.stderr,
        })

        try {
          const apiId = Number(await rl.question('API ID: '))
          const apiHash = await rl.question('API Hash: ')
          const phone = await rl.question('Phone: ')

          const result = await service.authLogin({
            apiId,
            apiHash,
            phone,
            code: '',
          })

          emit(result, options)
        } finally {
          rl.close()
        }
      })
    }),
  )
  .addCommand(
    new Command('status').action(async (_, command) => {
      await withService(command.optsWithGlobals(), async (service, options) => {
        emit(await service.authStatus(), options, formatAuthStatus)
      })
    }),
  )

program.command('sync').action(async (_, command) => {
  await withService(command.optsWithGlobals(), async (service, options) => {
    emit(await service.sync(), options, formatSyncResult)
  })
})

program
  .command('saved-dialogs')
  .description('Saved dialog commands')
  .addCommand(
    new Command('list').action(async (_, command) => {
      await withService(command.optsWithGlobals(), async (service, options) => {
        emit(await service.listSavedDialogs(), options, formatSavedDialogs)
      })
    }),
  )

const messages = program.command('messages').description('Message commands')

messages
  .command('list')
  .option('--dialog <savedPeerId>')
  .option('--search <query>')
  .option('--limit <number>', 'Page size', '20')
  .option('--cursor <cursor>')
  .action(async (commandOptions, command) => {
    await withService(command.optsWithGlobals(), async (service, options) => {
      const result = await service.listMessages({
        dialog: commandOptions.dialog,
        search: commandOptions.search,
        limit: Number(commandOptions.limit),
        cursor: commandOptions.cursor,
      } satisfies ListMessagesOptions)
      emit(result, options, formatMessagesPage)
    })
  })

messages
  .command('get')
  .argument('<id>')
  .option('--dialog <savedPeerId>')
  .action(async (id, commandOptions, command) => {
    await withService(command.optsWithGlobals(), async (service, options) => {
      const result = await service.getMessage(Number(id), {
        dialog: commandOptions.dialog,
      } satisfies GetMessageOptions)
      emit(result, options, formatContextBundle)
    })
  })

messages
  .command('context')
  .argument('<id>')
  .option('--dialog <savedPeerId>')
  .action(async (id, commandOptions, command) => {
    await withService(command.optsWithGlobals(), async (service, options) => {
      const result = await service.getContext(Number(id), {
        dialog: commandOptions.dialog,
      } satisfies GetMessageOptions)
      emit(result, options, formatContextBundle)
    })
  })

program
  .command('threads')
  .description('Thread commands')
  .addCommand(
    new Command('inspect')
      .argument('<id>')
      .option('--dialog <savedPeerId>')
      .action(async (id, commandOptions, command) => {
        await withService(command.optsWithGlobals(), async (service, options) => {
          const result = await service.inspectThread(Number(id), {
            dialog: commandOptions.dialog,
          } satisfies GetMessageOptions)
          emit(result, options, formatThread)
        })
      }),
  )

program.parseAsync(process.argv).catch((error: unknown) => {
  const tgsmError =
    error instanceof TgsmError
      ? error
      : new TgsmError({
          code: 'UNEXPECTED_ERROR',
          message: error instanceof Error ? error.message : 'Unexpected error',
          retryable: false,
        })

  const options = program.opts<GlobalOptions>()
  if (options.json) {
    process.stdout.write(`${JSON.stringify(tgsmError.toJSON(), null, 2)}\n`)
  } else {
    process.stderr.write(`error: ${tgsmError.message}\n`)
    if (tgsmError.suggestion) {
      process.stderr.write(`suggestion: ${tgsmError.suggestion}\n`)
    }
  }

  process.exitCode = errorCode(tgsmError.code)
})

async function withService(
  options: GlobalOptions,
  fn: (service: TgsmService, options: Required<GlobalOptions>) => Promise<void>,
): Promise<void> {
  const normalized: Required<GlobalOptions> = {
    json: Boolean(options.json),
    backend: (options.backend ?? 'telegram') as 'telegram' | 'fixture',
    fixture: options.fixture ?? '',
    home: options.home ?? '',
    account: options.account ?? 'default',
  }

  await ensureAccountDir({
    homeDir: normalized.home || undefined,
    account: normalized.account,
  })

  const cachePath = getCachePath({
    homeDir: normalized.home || undefined,
    account: normalized.account,
  })

  const source = resolveSource(normalized)
  const service = new TgsmService({
    cachePath,
    source,
  })

  await fn(service, normalized)
}

function resolveSource(options: Required<GlobalOptions>): TgsmSourceAdapter {
  if (options.backend === 'fixture') {
    if (!options.fixture) {
      throw new TgsmError({
        code: 'FIXTURE_REQUIRED',
        message: 'The fixture backend requires --fixture <path>.',
        retryable: false,
      })
    }
    return new FixtureSource(options.fixture)
  }

  return new TelegramSource()
}

function emit<T>(
  value: T,
  options: Required<GlobalOptions>,
  format?: (value: T) => string,
): void {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
    return
  }

  process.stdout.write(`${format ? format(value) : String(value)}\n`)
}

function errorCode(code: string): number {
  if (code.startsWith('AUTH')) return 3
  if (code.includes('SYNC') || code.includes('TELEGRAM')) return 2
  return 1
}
