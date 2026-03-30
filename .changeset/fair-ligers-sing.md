---
'@imadtg/tgsm': patch
---

Fix Telegram auth in Bun-based tgsm builds by replacing mtcute's Bun-incompatible SQLite session storage with persisted session strings. This restores `auth login`, `auth status`, and `sync`, preserves more useful auth failure messages, and avoids writing Telegram credentials before login succeeds.
