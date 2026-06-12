---
name: Application config
description: Server-wide application form settings (separate from per-form config)
---
- DB key: "appConfig" — shape: {cooldownHours: number, notifyApplicant: boolean, blacklist: string[]}
- API routes: GET/PUT /:guildId/app-config in guilds.ts
- Dashboard: Applications page "Settings & Blacklist" tab
- cooldownHours: how long a user must wait before reapplying (0 = no cooldown)
- notifyApplicant: whether to DM user on approve/deny
- blacklist: array of user IDs blocked from submitting any form
