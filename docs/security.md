# Security & Auth

Considerations for using a Telegram userbot safely.

## What Is a Userbot?

`tgsm` authenticates as **your actual Telegram account** (not a bot). This means:

- Full access to your Saved Messages (bot API can't do this)
- Uses the MTProto protocol (same as TG desktop/mobile apps)
- Requires your phone number + OTP for initial login
- Session persists locally (like logging into TG Desktop)

## Telegram ToS & Risk

> **Key point**: Reading your own Saved Messages is the lowest-risk userbot activity. You're not messaging other people, joining channels, or spamming.

Known risks with userbots:

| Activity | Risk Level | Notes |
|---|---|---|
| Reading own Saved Messages | 🟢 Very Low | Essentially the same as using TG app |
| Searching own messages | 🟢 Very Low | Normal API usage |
| Deleting own messages | 🟡 Low | Normal operation, but rate limit applies |
| Bulk operations (fast) | 🟠 Medium | Hitting API rate limits can trigger temp bans |
| Automated messaging to others | 🔴 High | Not what tgsm does, but worth noting |

## Rate Limiting

Built into the `TelegramService` layer via Effect.ts:

```typescript
// Configurable in ~/.tgsm/config.toml
[ratelimit]
messages_per_second = 2        # API calls per second
bulk_delay_ms = 500            # delay between batch operations
max_deletions_per_hour = 50    # safety cap on deletes
```

The rate limiter is implemented as an Effect Layer that wraps `TelegramService`:

```typescript
const RateLimitedTelegram = Layer.effect(
  TelegramService,
  Effect.gen(function* () {
    const inner = yield* TelegramService  // the unwrapped service
    const limiter = yield* RateLimiter    // token bucket
    return {
      getMessages: (opts) => limiter.withLimit(inner.getMessages(opts)),
      deleteMessage: (id) => limiter.withLimit(inner.deleteMessage(id)),
      // ...
    }
  })
)
```

## Session Storage

The mtcute session (auth keys, DC info) is stored locally:

| Aspect | Detail |
|---|---|
| Location | `~/.tgsm/session/` (or XDG path) |
| Format | mtcute's built-in storage (file-based) |
| Sensitivity | **High** — contains auth keys for your TG account |
| Protection | File permissions `0600` (owner read/write only) |

> **Never** commit session files to git. The `.gitignore` will exclude `~/.tgsm/` and any `.session` files.

## API Credentials

| Credential | Source | Storage |
|---|---|---|
| `API_ID` | [my.telegram.org/apps](https://my.telegram.org/apps) | `~/.tgsm/config.toml` or env var |
| `API_HASH` | [my.telegram.org/apps](https://my.telegram.org/apps) | `~/.tgsm/config.toml` or env var |

These are app-level credentials (identifying *your app*, not your account). They're less sensitive than the session but should still not be hardcoded or committed.

```toml
# ~/.tgsm/config.toml
[telegram]
api_id = 12345678
api_hash = "your-api-hash-here"
```

Or via environment variables:
```bash
export TGSM_API_ID=12345678
export TGSM_API_HASH=your-api-hash-here
```

## Logging & Audit

All mutating operations are logged locally:

```
~/.tgsm/audit.log
```

Format:
```
2025-03-18T16:00:00Z DELETE msg=42 status=soft_deleted expires=2025-03-18T16:10:00Z by=agent
2025-03-18T16:08:00Z RESTORE msg=42 status=restored by=human
2025-03-18T16:10:00Z PURGE msg=45,47 status=hard_deleted by=timeout
```

This audit trail is local-only — it never leaves your machine.
