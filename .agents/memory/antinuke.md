---
name: Anti-nuke system
description: Rebuilt anti-nuke with 9 thresholds, recovery cache, dangerous-perm/server-update watches, DM owner, role whitelist
---

## Config shape (DB key: "antinuke")
- `thresholds` now includes: channelDelete, channelCreate, roleDelete, roleCreate, ban, kick, webhookCreate, **webhookDelete**, **massTimeout**
- `whitelistRoles: string[]` — role-based exemption (in addition to `whitelist: string[]` for users)
- `dmOwner: boolean` — DM server owner on every trigger
- `watchRolePerms: boolean` — alert when dangerous perms (Admin, ManageGuild, etc.) added to a role
- `watchServerUpdate: boolean` — alert when verification level lowered or 2FA removed
- `restoreEnabled: boolean` — caches deleted channels/roles in memory (30 min) for `>antinuke recover`

## Recovery caches
- `channelRecoveryCache` / `roleRecoveryCache` — in-memory Maps (not DB-persisted, cleared on bot restart)
- `cacheDeletedChannel()` / `cacheDeletedRole()` exported from store
- Populated inside `channelDelete` and `roleDelete` event handlers in events/antinuke.ts
- Restored via `>antinuke recover [channels|roles]` command

**Why:** Previous system had no recovery, no role whitelist, no DM-owner feature, only 7 threshold types.

**How to apply:** Always call `cacheDeletedChannel`/`cacheDeletedRole` BEFORE the detection logic runs in the event handler so the cache is populated even if the trigger fires immediately.
