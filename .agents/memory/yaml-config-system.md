---
name: YAML config system
description: Additive YAML-per-guild config layer added on top of the existing JSON bot_store system
---

## Architecture

The YAML system is additive — it does NOT replace the existing JSON bot_store. It layers on top.

### New table
`guild_configs (guild_id TEXT PRIMARY KEY, config TEXT)` — raw YAML text per guild.
Created by both `initGuildConfigStore()` (bot) and `initDb()` (dashboard) via `CREATE TABLE IF NOT EXISTS`.

### New bot files
- `src/bot/store/guildConfig.ts` — loads YAML from `guild_configs`, deep-merges with DEFAULT_CONFIG, in-memory cache with 30s TTL. Exports: `getGuildConfig` (async, refreshes), `getCachedConfig` (sync, instant), `invalidateCache`, `setRawYaml`, `getRawYaml`.
- `src/bot/lib/yamlLevels.ts` — `getUserLevel(message)` + `getRequiredLevel(guildId, cmdName)` + `checkYamlLevel`. Bot owner / guild owner always = 100.
- `src/bot/lib/yamlFormatter.ts` — `sendYamlMessage(channel, YamlMessage, vars)` handles all 3 formats: plain string, `{embed:{...}}`, `{content:"...", embed:{...}}`.

### DEFAULT_CONFIG
Hardcoded in `guildConfig.ts`. Key defaults:
- prefix: `"!"`
- 60+ command levels (ban=50, warn=25, userinfo=0, etc.)
- command_aliases plugin (b→ban, k→kick, m→mute, etc.)
- preset_reasons plugin (spam, ads, toxic, nsfw, raid, slurs, etc.)
- moderation messages templates

### messageCreate.ts hooks (all additive)
1. **Dual prefix**: checks YAML prefix first, then DB prefix — message handled if either matches
2. **YAML aliases**: resolved before DB aliases (YAML takes priority)
3. **Preset reasons**: `$key` tokens in args resolved from `plugins.preset_reasons.config.presets`
4. **Level bypass**: if `getUserLevel >= getRequiredLevel`, skip all Discord perm checks

### Dashboard integration
- `GET /:guildId/yaml-config` — returns raw YAML from `guild_configs` if it exists; otherwise generates from JSON stores (backward compat)
- `PUT /:guildId/yaml-config` — saves to JSON stores AND writes raw YAML to `guild_configs`
- `POST /api/cache/yaml-config/:guildId` — invalidates bot's in-memory cache for a guild

**Why additive:** User explicitly requested "don't tear anything down, just add YAML". The existing modrole + commandPerms + Discord permission system remains as fallback for any user whose YAML level doesn't meet the threshold.
