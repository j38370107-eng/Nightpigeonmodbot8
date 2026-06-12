---
name: Anti-raid system
description: Rebuilt anti-raid with action levels, new-account detection, verification gate, whitelists
---

## Config shape (DB key: "antiraid")
- `actionLevel: 1|2|3|4` — 1=alert only, 2=timeout 1h, 3=kick, 4=ban+lockdown
- `joinThreshold` / `joinWindowMs` — mass-join detection
- `newAccountEnabled` / `newAccountAgeDays` / `newAccountAction: "flag"|"timeout"|"kick"|"ban"` — individual join screening
- `verificationEnabled` / `unverifiedRoleId` / `verifiedRoleId` / `verificationChannelId` / `verifyOnAgePass` — gate system
- `whitelist: string[]` (user IDs) / `whitelistRoles: string[]` (role IDs)
- `logChannel` / `alertChannelId`

**Why:** Original system only had basic mass-join + one action type, no whitelisting or per-user screening.

**How to apply:** When adding new raid detection logic, check `cfg.actionLevel` to determine severity. Whitelist check uses `cfg.whitelist.includes(member.id)` OR `cfg.whitelistRoles.some(r => roleIds.includes(r))`.
