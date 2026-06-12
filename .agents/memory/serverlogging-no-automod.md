---
name: Server logging — no automod category
description: The automod category was intentionally removed from the server logging system
---

## What was removed
- `"automod"` from `LogCategory` union type in `store/serverlogging.ts`
- `automodAction: "automod"` entry from `EVENT_CATEGORY` map in `store/serverlogging.ts`
- The `autoModerationActionExecution` event listener from `events/serverLogs.ts`
- `AutoModerationActionExecution` import from `events/serverLogs.ts`
- The `automod` CategoryDef block from `Logging.tsx` dashboard page

**Why:** User explicitly requested removal of the automod category from server logging.

**How to apply:** Do NOT re-add automod logging to the server-log system. If automod events need to be surfaced, they belong in the AutoMod module's own log channel, not the server logging system.
