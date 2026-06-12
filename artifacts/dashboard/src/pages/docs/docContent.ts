export interface SchemaField {
  key: string;
  type: string;
  default?: string;
  description: string;
  children?: SchemaField[];
}

export interface CommandDoc {
  trigger: string;
  aliases?: string[];
  usage: string;
  description: string;
  permissions?: string;
  examples?: string[];
}

export interface DocPage {
  id: string;
  title: string;
  type: "article" | "plugin";
  content: string;
  configKey?: string;
  defaultConfig?: string;
  schema?: SchemaField[];
  commands?: CommandDoc[];
}

export interface DocSection {
  id: string;
  title: string;
  pages: DocPage[];
}

export const docSections: DocSection[] = [
  // ────────────────────────────────────────────────────────────────────────────
  // GENERAL
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "general",
    title: "General",
    pages: [
      {
        id: "introduction",
        title: "Introduction",
        type: "article",
        content: `# Introduction

**NightPigeon** is a private Discord bot focused on security, moderation automation, and clean server management.

## What NightPigeon does

- **Anti-Nuke** — Detects and stops mass channel/role deletions, bans, webhooks, and server renames in real time
- **Anti-Raid** — Detects mass join events and suspicious new accounts, with 4 action levels up to full lockdown
- **AutoMod** — Automatic message filtering: bad words, spam, invite links, mass mentions, wall text, and more
- **Server Logging** — Detailed event logs for messages, members, channels, roles, and voice
- **Shortcuts & Aliases** — Define one-word punishment shortcuts and command aliases for your staff
- **YAML Configuration** — All settings are driven by a per-server YAML config editable from the dashboard

## Default prefix

The default command prefix is \`>\`. Your server admins can change it with \`>changeprefix\`.

## Getting started

1. Invite the bot to your server
2. Open the **Dashboard** and log in with Discord
3. Select your server and go to the **Config** tab
4. Paste your YAML config and save
5. Use \`>setmodlogs #channel\` to set where mod actions are logged`,
      },
      {
        id: "getting-started",
        title: "Getting started",
        type: "article",
        content: `# Getting Started

## Step 1 — Invite the bot

Use the invite link on the home page to add NightPigeon to your server. Make sure to grant it the **Administrator** permission so it can enforce all protections.

## Step 2 — Set your mod log channel

\`\`\`
>setmodlogs #mod-logs
\`\`\`

All automod actions, anti-nuke events, and security alerts will be posted there.

## Step 3 — Configure server logs (optional)

Open the dashboard → **Logging** tab to pick which events to log and where.

## Step 4 — Set up anti-nuke

\`\`\`
>antinuke enable
>antinuke action ban
>antinuke threshold channeldelete 3
>antinuke whitelist add @TrustedAdmin
\`\`\`

## Step 5 — Configure mute mode

By default the bot uses **Discord Timeout**. To use a role-based mute instead:

\`\`\`
>muteconfig role create
>muteconfig mode role
\`\`\`

## Step 6 — Define staff shortcuts (optional)

\`\`\`
>shortcut warn spam Spamming in chat
>shortcut mute 1h toxic 1h Toxic behaviour
>shortcut ban cheat Cheating / exploiting
\`\`\`

Staff can now run \`>spam @user\`, \`>toxic @user\`, and \`>cheat @user\` instantly.`,
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "configuration",
    title: "Configuration",
    pages: [
      {
        id: "yaml-format",
        title: "YAML format",
        type: "article",
        content: `# YAML Configuration Format

NightPigeon uses **YAML** for its per-server configuration. Edit it from the **Config** tab in the dashboard.

## Basic structure

\`\`\`yaml
# Command prefix (default is >)
prefix: ">"

# Permission levels
levels:
  users:
    "123456789012345678": 100   # User ID → level
  roles:
    "111222333444555666": 50    # Role ID → level
  commands:
    ban: 50
    kick: 50

# Command aliases
aliases:
  b: ban
  k: kick
  m: mute

# Preset shortcuts ("bam" and "warm" are built-in)
presets:
  bam:
    type: ban
    reason: "BAM — instant ban"
  warm:
    type: warn
    reason: "WARM — instant warn"
\`\`\`

## Top-level keys

| Key | Type | Description |
|-----|------|-------------|
| \`prefix\` | string | Command prefix for this server (max 5 chars) |
| \`levels\` | object | Permission level assignments (see Permissions) |
| \`aliases\` | object | Short aliases for existing commands |
| \`presets\` | object | Named punishment shortcuts |

## YAML tips

- Always quote Discord IDs — they are large numbers and can lose precision
- Use **2 spaces** for indentation, never tabs
- Comments start with \`#\`
- Booleans: \`true\` / \`false\` (lowercase)
- Omit a key to use its default value`,
      },
      {
        id: "permissions",
        title: "Permissions",
        type: "article",
        content: `# Permission Levels

NightPigeon uses a **numeric level system**. Higher numbers mean more access.

## Standard levels

| Level | Typical role |
|-------|-------------|
| 0 | Everyone (default) |
| 25 | Trusted member |
| 50 | Moderator |
| 75 | Senior Moderator |
| 100 | Administrator / Owner |

## Assigning levels

Set levels in your YAML config:

\`\`\`yaml
levels:
  users:
    "123456789012345678": 100   # specific user → full admin
  roles:
    "111222333444555666": 50    # your Mod role
    "222333444555666777": 25    # your Helper role
\`\`\`

## Per-command requirements

Override the level required to use any command:

\`\`\`yaml
levels:
  commands:
    shortcut: 50
    alias: 75
    antinuke: 100
\`\`\`

## Resolution order

1. Direct user-level assignment (highest priority)
2. Highest role-level among all the user's roles
3. Server owner always gets level 100
4. Bot owner gets level 100 everywhere

The highest applicable level is used.

## Discord permission mapping

Some commands bypass the YAML level system and require a specific Discord permission regardless:

| Command | Discord permission required |
|---------|----------------------------|
| \`antinuke\`, \`antiraid\`, \`resetconfig\`, \`modrole\`, \`protectedrole\`, \`alias\`, \`backup\` | Administrator |
| \`changeprefix\`, \`setmodlogs\`, \`setserverlogs\`, \`setautomodwarnexpiry\`, \`setexpiredate\`, \`automod\` | Manage Server |
| \`muteconfig\` | Manage Roles |
| \`shortcut\` | Moderate Members |`,
      },
      {
        id: "duration-format",
        title: "Duration format",
        type: "article",
        content: `# Duration Format

Durations are used in mute shortcuts, warning expiry, and automod settings.

## Format

A duration is a **number** followed by a **unit letter**:

| Unit | Letter | Example |
|------|--------|---------|
| Seconds | \`s\` | \`30s\` |
| Minutes | \`m\` | \`5m\` |
| Hours | \`h\` | \`2h\` |
| Days | \`d\` | \`7d\` |

## Examples

| Input | Meaning |
|-------|---------|
| \`30s\` | 30 seconds |
| \`5m\` | 5 minutes |
| \`1h\` | 1 hour |
| \`12h\` | 12 hours |
| \`1d\` | 1 day |
| \`7d\` | 7 days |
| \`30d\` | 30 days |

## Argument notation

- **\`<required>\`** — must be provided
- **\`[optional]\`** — can be omitted
- **\`<value...>\`** — captures everything remaining (e.g. reason text)`,
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // COMMANDS
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "commands",
    title: "Commands",
    pages: [
      {
        id: "commands-general",
        title: "General",
        type: "article",
        commands: [
          {
            trigger: "help",
            aliases: ["h", "commands"],
            usage: ">help [command]",
            description: "Show all available commands, or detailed help for a specific command. Also works for shortcuts and custom commands.",
            permissions: "Everyone",
            examples: [">help", ">help antinuke", ">help spam"],
          },
          {
            trigger: "ping",
            aliases: ["latency"],
            usage: ">ping",
            description: "Check the bot's roundtrip latency and WebSocket ping.",
            permissions: "Everyone",
            examples: [">ping"],
          },
          {
            trigger: "dashboard",
            aliases: ["dash", "panel"],
            usage: ">dashboard",
            description: "Get a direct link to the web dashboard for this server.",
            permissions: "Everyone",
            examples: [">dashboard"],
          },
        ],
        content: `# General Commands

These commands are available to everyone in the server.`,
      },
      {
        id: "commands-configuration",
        title: "Configuration",
        type: "article",
        commands: [
          {
            trigger: "changeprefix",
            aliases: ["setprefix", "prefix"],
            usage: ">changeprefix <new prefix>",
            description: "Change the bot's command prefix for this server. Maximum 5 characters.",
            permissions: "Manage Server",
            examples: [">changeprefix !", ">changeprefix >>", ">prefix ."],
          },
          {
            trigger: "setmodlogs",
            aliases: ["setlogchannel", "setlogs", "logchannel"],
            usage: ">setmodlogs <#channel>",
            description: "Set the channel where moderation action logs are posted. Accepts a channel mention or ID.",
            permissions: "Manage Server",
            examples: [">setmodlogs #mod-logs", ">logchannel #bot-logs"],
          },
          {
            trigger: "setserverlogs",
            aliases: ["serverlogs", "serverlogchannel"],
            usage: ">setserverlogs",
            description: "Opens a dashboard link to configure server event logging (message edits, member joins, voice events, etc.).",
            permissions: "Manage Server",
            examples: [">setserverlogs"],
          },
          {
            trigger: "setexpiredate",
            aliases: ["setexpiry", "warnexpiry", "setwarnduration"],
            usage: ">setexpiredate <duration | 0>",
            description: "Set how long warnings last before they expire. Range: 1 day to 3 months. Use `0` or `none` for permanent (never expire). Run with no argument to see the current setting.",
            permissions: "Manage Server",
            examples: [
              ">setexpiredate 7d",
              ">setexpiredate 30d",
              ">setexpiredate 3m",
              ">setexpiredate 0",
              ">setexpiredate none",
            ],
          },
          {
            trigger: "setautomodwarnexpiry",
            aliases: ["automodwarnexpiry", "setamwarnexpiry"],
            usage: ">setautomodwarnexpiry <duration | 0>",
            description: "Set how long AutoMod-issued warnings last before they expire (separate from manual warnings). Range: 1 day to 1 month. Use `0` or `none` for permanent. Run with no argument to see the current setting.",
            permissions: "Manage Server",
            examples: [
              ">setautomodwarnexpiry 1d",
              ">setautomodwarnexpiry 7d",
              ">setautomodwarnexpiry 0",
            ],
          },
          {
            trigger: "backup",
            aliases: ["bk"],
            usage: ">backup export | import",
            description: "Export all server settings to a JSON file (sent to your DMs), or import a previously exported backup. Import requires you to attach the .json file and confirm. Works in DMs too — the backup's guildId is used to find the server.",
            permissions: "Administrator",
            examples: [">backup export", ">backup import (with .json file attached)"],
          },
          {
            trigger: "resetconfig",
            aliases: ["configreset", "resetbot", "factoryreset"],
            usage: ">resetconfig",
            description: "Reset ALL bot configuration for this server back to defaults. Shows a confirmation button before proceeding. Resets: prefix, mod log channel, server log channel, warn expiry, automod, anti-nuke, anti-raid, mod roles, shortcuts, and aliases. Does NOT affect infraction history.",
            permissions: "Administrator",
            examples: [">resetconfig"],
          },
        ],
        content: `# Configuration Commands

Commands for setting up and managing the bot's configuration.

## What the backup includes

When you run \`>backup export\`, the bot sends you a JSON file containing:

- Server settings (prefix, log channels, warn expiry)
- Anti-Nuke configuration
- Anti-Raid configuration
- AutoMod configuration
- Mod roles
- Shortcuts
- Aliases

You can restore this file on the same server or import it into a different server.`,
      },
      {
        id: "commands-security",
        title: "Security",
        type: "article",
        commands: [
          {
            trigger: "antinuke",
            aliases: ["an", "nuke"],
            usage: ">antinuke <subcommand> [...]",
            description: "Configure the Anti-Nuke system. See the Anti-Nuke plugin page for full details on all subcommands.",
            permissions: "Administrator",
            examples: [
              ">antinuke enable",
              ">antinuke action ban",
              ">antinuke threshold channeldelete 3",
              ">antinuke window 10",
              ">antinuke whitelist add @Admin",
              ">antinuke whitelist remove @Admin",
              ">antinuke whitelist list",
              ">antinuke logchannel #security-log",
              ">antinuke dmowner on",
              ">antinuke watch roles on",
              ">antinuke watch server on",
              ">antinuke watch everyone on",
              ">antinuke roleprotect revert on",
              ">antinuke roleprotect punish on",
              ">antinuke prune on",
              ">antinuke vanity on",
              ">antinuke serverrename on",
              ">antinuke servericon on",
              ">antinuke rolerename on",
              ">antinuke channelrename on",
              ">antinuke restore on",
              ">antinuke recover channels",
              ">antinuke recover roles",
              ">antinuke disable",
            ],
          },
          {
            trigger: "antiraid",
            aliases: ["ar", "raid"],
            usage: ">antiraid",
            description: "Opens a dashboard link to configure the Anti-Raid system. All Anti-Raid settings are managed through the dashboard.",
            permissions: "Administrator",
            examples: [">antiraid"],
          },
        ],
        content: `# Security Commands

NightPigeon has two independent security systems:

## Anti-Nuke (\`>antinuke\`)

Protects against mass destructive actions by compromised or rogue admins. Fully configurable from the command line.

### Subcommands

| Subcommand | Description |
|-----------|-------------|
| \`enable\` / \`disable\` | Turn Anti-Nuke on or off |
| \`action <ban\|kick\|strip>\` | Action taken against the attacker |
| \`threshold <type> <count>\` | How many events per window trigger the system |
| \`window <seconds>\` | Detection window in seconds (1–120) |
| \`whitelist add\|remove\|list [@user\|roleID]\` | Users/roles exempt from anti-nuke |
| \`logchannel <#ch\|clear>\` | Where to post anti-nuke alerts |
| \`dmowner <on\|off>\` | DM the server owner when triggered |
| \`watch roles\|server\|everyone <on\|off>\` | Monitor role perm changes, server settings, @everyone |
| \`roleprotect revert\|punish <on\|off>\` | Auto-revert and/or punish dangerous role edits |
| \`prune <on\|off>\` | Protect against unauthorized member pruning |
| \`vanity <on\|off>\` | Protect the server vanity URL |
| \`serverrename <on\|off>\` | Protect the server name |
| \`servericon <on\|off>\` | Protect the server icon |
| \`rolerename <on\|off>\` | Protect against mass role renames |
| \`channelrename <on\|off>\` | Protect against mass channel renames |
| \`restore <on\|off>\` | Cache deleted channels/roles for recovery |
| \`recover [channels\|roles]\` | Recreate recently deleted channels or roles |

### Threshold types

| Type | What it tracks |
|------|---------------|
| \`channeldelete\` | Channels deleted |
| \`channelcreate\` | Channels created |
| \`roledelete\` | Roles deleted |
| \`rolecreate\` | Roles created |
| \`ban\` | Members banned |
| \`kick\` | Members kicked |
| \`webhookcreate\` | Webhooks created |
| \`webhookdelete\` | Webhooks deleted |
| \`masstimeout\` | Members timed out |
| \`channelrename\` | Channels renamed |
| \`rolerename\` | Roles renamed |

## Anti-Raid (\`>antiraid\`)

Detects mass join events and suspicious accounts. Configured entirely through the dashboard — run \`>antiraid\` for a link.`,
      },
      {
        id: "commands-automod",
        title: "AutoMod",
        type: "article",
        commands: [
          {
            trigger: "automod",
            aliases: ["am"],
            usage: ">automod",
            description: "Opens a dashboard link to configure AutoMod rules. All AutoMod settings are managed through the dashboard.",
            permissions: "Manage Server",
            examples: [">automod"],
          },
          {
            trigger: "muteconfig",
            aliases: ["mutesettings"],
            usage: ">muteconfig [subcommand] [...]",
            description: "Configure how mutes work — Discord Timeout (default) or a custom Mute Role. Run with no argument to see current settings.",
            permissions: "Manage Roles",
            examples: [
              ">muteconfig",
              ">muteconfig mode timeout",
              ">muteconfig mode role",
              ">muteconfig role create",
              ">muteconfig role set @Muted",
              ">muteconfig striproles on",
              ">muteconfig striproles off",
            ],
          },
        ],
        content: `# AutoMod Commands

## AutoMod dashboard (\`>automod\`)

All AutoMod rules are configured in the dashboard. Run \`>automod\` for a direct link.

AutoMod modules available in the dashboard:
- **Word filter** — Block specific words or wildcard patterns
- **Invite links** — Block Discord invite links
- **Spam** — Detect rapid message sending
- **Mention spam** — Detect mass user/role mentions
- **Link spam** — Detect rapid link posting
- **URL filter** — Whitelist or blacklist specific domains
- **Wall text** — Block excessively long messages
- **Duplicate messages** — Block copy-pasted floods
- **Character flood** — Detect repeated characters or emoji spam
- **File filter** — Block specific file extensions

Each module has its own action (warn, delete, mute, kick, ban), affected/ignored roles, and affected/ignored channels.

## Mute configuration (\`>muteconfig\`)

Controls how \`mute\` actions work when triggered by AutoMod or shortcuts.

### Subcommands

| Subcommand | Description |
|-----------|-------------|
| *(none)* | Show current mute settings |
| \`mode timeout\` | Use Discord's native Timeout (default) |
| \`mode role\` | Use a dedicated Mute Role |
| \`role create\` | Create a "Muted" role with channel deny overrides set automatically |
| \`role set @role\` | Use an existing role as the mute role |
| \`striproles on\|off\` | Strip all roles from the member when muted (role mode only) |

### Notes

- **Timeout mode** applies Discord's built-in timeout — works without any role setup
- **Role mode** requires a mute role to be set first with \`>muteconfig role create\` or \`>muteconfig role set\`
- \`striproles\` only works in role mode`,
      },
      {
        id: "commands-permissions",
        title: "Permissions & Roles",
        type: "article",
        commands: [
          {
            trigger: "modrole",
            aliases: ["mr"],
            usage: ">modrole <add|remove|list|clear> [@role]",
            description: "Manage which roles can use moderation commands. Mod roles grant access to moderation features without needing Administrator.",
            permissions: "Administrator",
            examples: [
              ">modrole add @Moderator",
              ">modrole add 111222333444555666",
              ">modrole remove @Moderator",
              ">modrole list",
              ">modrole clear",
            ],
          },
          {
            trigger: "protectedrole",
            aliases: ["protrole"],
            usage: ">protectedrole <add|remove|list> [@role]",
            description: "Manage roles that are immune to punishments. Members with a protected role cannot be warned, muted, kicked, or banned by the bot.",
            permissions: "Administrator",
            examples: [
              ">protectedrole add @Admin",
              ">protectedrole add @Owner",
              ">protectedrole remove @Admin",
              ">protectedrole list",
            ],
          },
        ],
        content: `# Permissions & Role Commands

## Mod Roles (\`>modrole\`)

Mod roles let you grant moderation access without giving someone Discord Administrator. Any member with a configured mod role can use moderation-level commands.

Up to 50 mod roles can be configured per server.

## Protected Roles (\`>protectedrole\`)

Protected roles make members immune to all bot punishments. Use this for your admin team so they can't accidentally be punished by automod or shortcuts.

Members with a protected role cannot be:
- Warned
- Muted
- Kicked
- Banned`,
      },
      {
        id: "commands-shortcuts",
        title: "Shortcuts & Aliases",
        type: "article",
        commands: [
          {
            trigger: "shortcut",
            aliases: ["sc"],
            usage: ">shortcut <warn|mute|kick|ban|list|delete> [name] [duration] <reason>",
            description: "Create named punishment shortcuts. Once created, staff can run `>name @user` to instantly apply the preset action, duration, and reason. Up to 50 shortcuts per server.",
            permissions: "Moderate Members (to manage) — any moderator to use",
            examples: [
              ">shortcut warn spam Spamming in chat",
              ">shortcut mute toxic 1h Toxic behaviour",
              ">shortcut mute permatoxic Permanently toxic (role mode)",
              ">shortcut kick advert Advertising other servers",
              ">shortcut ban cheat Cheating / exploiting",
              ">shortcut ban tempban 7d Temporary ban",
              ">shortcut list",
              ">shortcut delete toxic",
              ">sc del spam",
            ],
          },
          {
            trigger: "alias",
            aliases: [],
            usage: ">alias <add|remove|list> [alias] [command]",
            description: "Create custom short aliases for any built-in command. Aliases act as alternative trigger words. Up to 10 aliases per command.",
            permissions: "Administrator",
            examples: [
              ">alias add b ban",
              ">alias add k kick",
              ">alias add an antinuke",
              ">alias remove b",
              ">alias list",
            ],
          },
        ],
        content: `# Shortcuts & Aliases

## Shortcuts (\`>shortcut\`)

Shortcuts let your staff apply a pre-configured punishment with a single command. Instead of typing \`>mute @user 1h Toxic behaviour\`, they can run \`>toxic @user\`.

### Shortcut types

| Type | Description |
|------|-------------|
| \`warn\` | Issue a warning |
| \`mute\` | Mute (timeout or role) |
| \`kick\` | Kick from server |
| \`ban\` | Ban (permanent or timed) |

### Duration rules

- **Warn / Kick** — no duration needed
- **Mute** — duration is optional (omit for permanent in role mode; required for timeout mode)
- **Ban** — duration is optional (omit for permanent ban; max 30d for timed ban)

### Limits

- Maximum **50 shortcuts** per server
- Shortcut names cannot clash with built-in command names
- Shortcut names are case-insensitive

### Example setup

\`\`\`
>shortcut warn spam       Spamming in chat
>shortcut warn caps       Excessive caps
>shortcut mute 1h toxic   1h Toxic behaviour
>shortcut mute 24h flood  24h Flooding channels
>shortcut kick advert     Advertising other servers
>shortcut ban cheat       Cheating / exploiting
>shortcut ban 7d tempban  Temporary ban (7 days)
\`\`\`

Staff now run \`>spam @user\`, \`>toxic @user\`, etc.

---

## Aliases (\`>alias\`)

Aliases create alternative names for built-in commands. Unlike shortcuts (which apply a punishment), aliases just redirect to another command.

### Example

\`>alias add b ban\` means \`>b @user reason\` is now identical to \`>ban @user reason\`.

### Limits

- Each command can have a maximum of **10 aliases**
- Aliases cannot overwrite existing built-in command names`,
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // PLUGINS
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "plugins",
    title: "Plugins",
    pages: [
      {
        id: "plugin-antinuke",
        title: "Anti-Nuke",
        type: "plugin",
        configKey: "antinuke",
        defaultConfig: `# Anti-Nuke is configured via bot commands, not YAML.
# Use >antinuke enable to get started.
#
# Example command setup:
#   >antinuke enable
#   >antinuke action ban
#   >antinuke threshold channeldelete 3
#   >antinuke threshold roledelete 3
#   >antinuke threshold ban 5
#   >antinuke window 10
#   >antinuke whitelist add @TrustedAdmin
#   >antinuke logchannel #security-logs
#   >antinuke dmowner on
#   >antinuke restore on`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Whether Anti-Nuke protection is active" },
          { key: "action", type: "ban | kick | strip", default: "ban", description: "Action taken against the attacker. 'strip' removes all roles without banning." },
          { key: "windowMs", type: "number (ms)", default: "10000", description: "Time window in milliseconds for threshold counting" },
          { key: "dmOwner", type: "boolean", default: "false", description: "DM the server owner when Anti-Nuke triggers" },
          { key: "watchRolePerms", type: "boolean", default: "false", description: "Watch for dangerous permission grants to any role" },
          { key: "watchServerUpdate", type: "boolean", default: "false", description: "Watch for unauthorized server setting changes" },
          { key: "watchEveryonePerms", type: "boolean", default: "false", description: "Watch for dangerous permissions being granted to @everyone" },
          { key: "revertRolePerms", type: "boolean", default: "false", description: "Automatically revert dangerous role permission changes" },
          { key: "punishRolePerms", type: "boolean", default: "false", description: "Punish the executor of dangerous role permission changes" },
          { key: "restoreEnabled", type: "boolean", default: "false", description: "Cache deleted channels and roles for recovery via >antinuke recover" },
          { key: "antiPruneEnabled", type: "boolean", default: "false", description: "Punish users who prune members without being whitelisted" },
          { key: "antiVanityEnabled", type: "boolean", default: "false", description: "Protect the server vanity URL from being changed" },
          { key: "antiServerRenameEnabled", type: "boolean", default: "false", description: "Block unauthorized server name changes" },
          { key: "antiServerIconEnabled", type: "boolean", default: "false", description: "Block unauthorized server icon changes" },
          { key: "antiRoleRenameEnabled", type: "boolean", default: "false", description: "Detect mass role renames" },
          { key: "antiChannelRenameEnabled", type: "boolean", default: "false", description: "Detect mass channel renames" },
          {
            key: "thresholds", type: "object", description: "Per-action thresholds that trigger Anti-Nuke",
            children: [
              { key: "channelDelete", type: "number", default: "3", description: "Channel deletions before triggering" },
              { key: "channelCreate", type: "number", default: "5", description: "Channel creations before triggering" },
              { key: "roleDelete", type: "number", default: "3", description: "Role deletions before triggering" },
              { key: "roleCreate", type: "number", default: "5", description: "Role creations before triggering" },
              { key: "ban", type: "number", default: "5", description: "Bans before triggering" },
              { key: "kick", type: "number", default: "5", description: "Kicks before triggering" },
              { key: "webhookCreate", type: "number", default: "3", description: "Webhook creations before triggering" },
              { key: "webhookDelete", type: "number", default: "3", description: "Webhook deletions before triggering" },
              { key: "massTimeout", type: "number", default: "5", description: "Timeouts issued before triggering" },
              { key: "channelRename", type: "number", default: "5", description: "Channel renames before triggering" },
              { key: "roleRename", type: "number", default: "5", description: "Role renames before triggering" },
            ],
          },
        ],
        commands: [
          { trigger: "antinuke", aliases: ["an", "nuke"], usage: ">antinuke enable", description: "Enable Anti-Nuke protection", permissions: "Administrator" },
          { trigger: "antinuke", aliases: ["an", "nuke"], usage: ">antinuke action <ban|kick|strip>", description: "Set what happens to attackers", permissions: "Administrator" },
          { trigger: "antinuke", aliases: ["an", "nuke"], usage: ">antinuke threshold <type> <count>", description: "Set per-event trigger thresholds", permissions: "Administrator" },
          { trigger: "antinuke", aliases: ["an", "nuke"], usage: ">antinuke whitelist add|remove|list [@user|roleID]", description: "Manage whitelisted users/roles", permissions: "Administrator" },
          { trigger: "antinuke", aliases: ["an", "nuke"], usage: ">antinuke recover [channels|roles]", description: "Recreate recently deleted channels or roles", permissions: "Administrator" },
        ],
        content: `The **Anti-Nuke** plugin monitors your server in real time for signs of a malicious admin or compromised account attempting to destroy the server.

## How it works

Every destructive Discord action (channel delete, role delete, ban, webhook creation, etc.) is counted per-user within a sliding time window. If a user hits a threshold, they are immediately punished and the action is logged.

## Actions

| Action | Effect |
|--------|--------|
| \`ban\` | The attacker is permanently banned |
| \`kick\` | The attacker is kicked |
| \`strip\` | All roles are removed from the attacker |

## Whitelist

Always whitelist your most trusted admins so they aren't accidentally triggered. Add them with:

\`\`\`
>antinuke whitelist add @TrustedAdmin
\`\`\`

You can also whitelist entire roles:

\`\`\`
>antinuke whitelist add @ServerOwner
\`\`\`

## Role permission protection

When \`watch roles\` is on, the bot monitors any role that gets dangerous permissions added (Administrator, Manage Guild, Ban Members, etc.).

- **revert on** → The change is automatically undone
- **punish on** → The user who made the change is actioned

## Channel & Role recovery

When \`restore on\` is enabled, deleted channels and roles are cached in memory. If a nuke happens, run:

\`\`\`
>antinuke recover channels
>antinuke recover roles
\`\`\`

to recreate them. The cache expires on bot restart.

## Recommended starting config

\`\`\`
>antinuke enable
>antinuke action ban
>antinuke threshold channeldelete 3
>antinuke threshold roledelete 3
>antinuke threshold ban 5
>antinuke threshold kick 5
>antinuke threshold webhookcreate 3
>antinuke window 10
>antinuke logchannel #security-logs
>antinuke dmowner on
>antinuke restore on
>antinuke whitelist add @YourMainAdmin
\`\`\``,
      },
      {
        id: "plugin-antiraid",
        title: "Anti-Raid",
        type: "plugin",
        configKey: "antiraid",
        defaultConfig: `# Anti-Raid is configured through the Dashboard.
# Run >antiraid for a direct link.`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Whether Anti-Raid is active" },
          { key: "joinThreshold", type: "number", default: "10", description: "Number of joins within the window to trigger a raid alert" },
          { key: "joinWindowMs", type: "number (ms)", default: "10000", description: "Time window for counting joins (milliseconds)" },
          { key: "joinScope", type: "all | suspicious", default: "all", description: "Whether all joins or only suspicious joins count toward the threshold" },
          { key: "actionLevel", type: "1 | 2 | 3 | 4", default: "1", description: "What the bot does when a raid is detected (see Action Levels)" },
          { key: "newAccountEnabled", type: "boolean", default: "false", description: "Flag/action accounts newer than newAccountAgeDays" },
          { key: "newAccountAgeDays", type: "number", default: "7", description: "Account age in days to be considered 'new'" },
          { key: "newAccountAction", type: "flag | timeout | kick | ban", default: "flag", description: "Action for new accounts on join" },
          { key: "noAvatarEnabled", type: "boolean", default: "false", description: "Flag/action accounts with no profile picture" },
          { key: "noAvatarAction", type: "flag | timeout | kick | ban", default: "flag", description: "Action for no-avatar accounts" },
          { key: "defaultUsernameEnabled", type: "boolean", default: "false", description: "Flag/action Discord auto-generated usernames" },
          { key: "defaultUsernameAction", type: "flag | timeout | kick | ban", default: "flag", description: "Action for default username accounts" },
          { key: "usernameFilterEnabled", type: "boolean", default: "false", description: "Enable the custom username pattern filter" },
          { key: "usernameFilterPatterns", type: "string[]", default: "[]", description: "Substrings/patterns that trigger the username filter" },
          { key: "usernameFilterAction", type: "flag | timeout | kick | ban", default: "flag", description: "Action for matched usernames" },
          { key: "suspiciousEnabled", type: "boolean", default: "false", description: "Action accounts that accumulate multiple suspicious signals" },
          { key: "suspiciousThreshold", type: "number", default: "2", description: "How many signals required to be 'suspicious' (1–4)" },
          { key: "suspiciousAction", type: "flag | timeout | kick | ban", default: "flag", description: "Action for suspicious accounts" },
          { key: "botGuardEnabled", type: "boolean", default: "false", description: "Only whitelisted users may add bots" },
          { key: "botGuardRemoveBot", type: "boolean", default: "true", description: "Kick the unauthorized bot itself" },
          { key: "botGuardPunishAdder", type: "boolean", default: "true", description: "Punish the user who added the unauthorized bot" },
          { key: "botGuardAdderAction", type: "flag | kick | ban | strip", default: "kick", description: "Action taken against the unauthorized adder" },
        ],
        commands: [
          { trigger: "antiraid", aliases: ["ar", "raid"], usage: ">antiraid", description: "Get a dashboard link to configure Anti-Raid", permissions: "Administrator" },
        ],
        content: `The **Anti-Raid** plugin protects your server from coordinated mass-join attacks and suspicious account types.

## Action levels

| Level | What happens |
|-------|-------------|
| 1 | Alert only — logs the event and DMs the owner |
| 2 | Timeout all raid joiners for 1 hour |
| 3 | Kick all raid joiners |
| 4 | Ban all raid joiners + enable server lockdown |

## Suspicious signals

The bot tracks four signals for each joining account:

1. Account is newer than the configured age threshold
2. Account has no profile picture
3. Account has a Discord auto-generated username
4. Account's username matches a custom filter pattern

When \`suspiciousEnabled\` is on, accounts that accumulate enough signals are automatically actioned.

## Bot Guard

When enabled, only users on the Anti-Raid **whitelist** may add bots to the server. Anyone else who adds a bot will:
1. Have their bot kicked (if \`botGuardRemoveBot\` is on)
2. Be actioned themselves (if \`botGuardPunishAdder\` is on)

Specific bots can be permanently allowed regardless via the dashboard.

## Configuration

All Anti-Raid settings are managed through the dashboard. Run \`>antiraid\` in chat for a direct link to your server's Anti-Raid settings.`,
      },
      {
        id: "plugin-automod",
        title: "AutoMod",
        type: "plugin",
        configKey: "automod",
        defaultConfig: `# AutoMod is configured through the Dashboard.
# Run >automod for a direct link.`,
        schema: [
          { key: "exemptRoles", type: "string[]", default: "[]", description: "Role IDs that are fully exempt from all AutoMod rules" },
          { key: "exemptChannels", type: "string[]", default: "[]", description: "Channel IDs that are fully exempt from all AutoMod rules" },
          { key: "silent", type: "boolean", default: "false", description: "If true, AutoMod acts silently without posting public notices" },
          {
            key: "filter", type: "object", description: "Word filter module",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable the word filter" },
              { key: "words", type: "string[]", default: "[]", description: "Exact words to block" },
              { key: "wildcardWords", type: "string[]", default: "[]", description: "Wildcard patterns — use * as a wildcard (e.g. bad*word)" },
              { key: "action", type: "warn | delete | mute | kick | ban", default: "delete", description: "Action when triggered" },
            ],
          },
          {
            key: "inviteLinks", type: "object", description: "Discord invite link filter",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Block Discord invite links" },
              { key: "action", type: "warn | delete | mute | kick | ban", default: "delete", description: "Action when triggered" },
            ],
          },
          {
            key: "spam", type: "object", description: "Message spam detection",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable spam detection" },
              { key: "limit", type: "number", default: "5", description: "Number of messages in the window that triggers the rule" },
              { key: "windowMs", type: "number (ms)", default: "5000", description: "Window size in milliseconds" },
              { key: "action", type: "warn | delete | mute | kick | ban", default: "mute", description: "Action when triggered" },
            ],
          },
          {
            key: "mentionSpam", type: "object", description: "Mass mention detection",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable mention spam detection" },
              { key: "threshold", type: "number", default: "5", description: "Number of mentions in a single message to trigger" },
              { key: "action", type: "warn | delete | mute | kick | ban", default: "mute", description: "Action when triggered" },
            ],
          },
          {
            key: "wallText", type: "object", description: "Wall-of-text detection",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable wall-text detection" },
              { key: "maxLength", type: "number", default: "1000", description: "Max message character length" },
              { key: "maxLines", type: "number", default: "15", description: "Max number of lines in a message" },
              { key: "action", type: "warn | delete | mute | kick | ban", default: "delete", description: "Action when triggered" },
            ],
          },
          {
            key: "linkSpam", type: "object", description: "Link spam detection",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable link spam detection" },
              { key: "limit", type: "number", default: "3", description: "Links per window to trigger" },
              { key: "windowMs", type: "number (ms)", default: "10000", description: "Window size in milliseconds" },
              { key: "action", type: "warn | delete | mute | kick | ban", default: "delete", description: "Action when triggered" },
            ],
          },
          {
            key: "urlFilter", type: "object", description: "URL domain filter",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable URL filtering" },
              { key: "mode", type: "blacklist | whitelist", default: "blacklist", description: "Block listed domains (blacklist) or only allow listed domains (whitelist)" },
              { key: "blockAll", type: "boolean", default: "false", description: "Block all URLs regardless of domain (whitelist mode only)" },
              { key: "domains", type: "string[]", default: "[]", description: "List of domains to block or allow" },
              { key: "action", type: "warn | delete | mute | kick | ban", default: "delete", description: "Action when triggered" },
            ],
          },
          {
            key: "duplicate", type: "object", description: "Duplicate message detection",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable duplicate detection" },
              { key: "count", type: "number", default: "3", description: "How many identical messages trigger the rule" },
              { key: "action", type: "warn | delete | mute | kick | ban", default: "delete", description: "Action when triggered" },
            ],
          },
          {
            key: "charFlood", type: "object", description: "Character/emoji flood detection",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable character flood detection" },
              { key: "maxRepeat", type: "number", default: "10", description: "Max consecutive identical characters allowed" },
              { key: "maxEmoji", type: "number", default: "10", description: "Max emojis per message" },
              { key: "action", type: "warn | delete | mute | kick | ban", default: "delete", description: "Action when triggered" },
            ],
          },
          {
            key: "fileFilter", type: "object", description: "File attachment filter",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable file filter" },
              { key: "blockedExtensions", type: "string[]", default: "[]", description: "File extensions to block (e.g. exe, zip, bat)" },
              { key: "action", type: "warn | delete | mute | kick | ban", default: "delete", description: "Action when triggered" },
            ],
          },
          {
            key: "punishmentSteps", type: "array", description: "Warn escalation — automatic escalation after X automod warns",
            children: [
              { key: "strikes", type: "number", description: "Number of automod warns that triggers this step" },
              { key: "action", type: "warn | mute | kick | ban", description: "Action to apply at this strike count" },
              { key: "duration", type: "duration string", description: "Duration for mute/ban actions (e.g. 1h, 7d)" },
            ],
          },
        ],
        commands: [
          { trigger: "automod", aliases: ["am"], usage: ">automod", description: "Get a dashboard link to configure AutoMod", permissions: "Manage Server" },
          { trigger: "setautomodwarnexpiry", aliases: ["automodwarnexpiry", "setamwarnexpiry"], usage: ">setautomodwarnexpiry <duration | 0>", description: "Set how long AutoMod warnings last (1d–1m, or 0 for permanent)", permissions: "Manage Server", examples: [">setautomodwarnexpiry 7d", ">setautomodwarnexpiry 0"] },
          { trigger: "setexpiredate", aliases: ["setexpiry", "warnexpiry", "setwarnduration"], usage: ">setexpiredate <duration | 0>", description: "Set how long manual warnings last (1d–3m, or 0 for permanent)", permissions: "Manage Server", examples: [">setexpiredate 30d", ">setexpiredate none"] },
        ],
        content: `The **AutoMod** plugin provides automatic message moderation without requiring moderator intervention.

## How AutoMod works

1. Every message is checked against all enabled AutoMod modules
2. If a module triggers, the message is deleted and the configured action is taken
3. For \`warn\` actions, the bot tracks a per-user strike count
4. When a user hits enough strikes, punishment escalation kicks in (if configured)

## Module actions

| Action | Description |
|--------|-------------|
| \`warn\` | Add to the user's automod strike count (triggers escalation) |
| \`delete\` | Delete the message only |
| \`mute\` | Delete + mute the user |
| \`kick\` | Delete + kick the user |
| \`ban\` | Delete + ban the user |

## Warn escalation

Set up automatic escalation in the dashboard. Example: after 3 automod warns → mute 1h, after 5 warns → kick, after 7 warns → ban.

## Per-module overrides

Each module can have its own:
- **Affected roles** — only apply the rule to these roles
- **Ignored roles** — never apply to these roles
- **Affected channels** — only apply in these channels
- **Ignored channels** — never apply in these channels

## Silent mode

When \`silent\` is enabled, AutoMod acts without posting any public notice in the channel. Actions are still logged to the mod log channel.`,
      },
      {
        id: "plugin-server-logs",
        title: "Server Logs",
        type: "plugin",
        configKey: "serverlogging",
        defaultConfig: `# Server Logs are configured through the Dashboard.
# Run >setserverlogs for a direct link.`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable server event logging" },
          { key: "channelId", type: "string | null", default: "null", description: "Channel ID where log events are posted" },
          {
            key: "categories", type: "object", description: "Per-category enable/disable and optional channel overrides",
            children: [
              { key: "messageDelete", type: "boolean", default: "false", description: "Log deleted messages" },
              { key: "messageEdit", type: "boolean", default: "false", description: "Log edited messages (before/after)" },
              { key: "memberJoin", type: "boolean", default: "false", description: "Log member joins with account age" },
              { key: "memberLeave", type: "boolean", default: "false", description: "Log member leaves" },
              { key: "memberBan", type: "boolean", default: "false", description: "Log bans" },
              { key: "memberUnban", type: "boolean", default: "false", description: "Log unbans" },
              { key: "memberKick", type: "boolean", default: "false", description: "Log kicks" },
              { key: "memberNickname", type: "boolean", default: "false", description: "Log nickname changes" },
              { key: "memberRoles", type: "boolean", default: "false", description: "Log role additions/removals" },
              { key: "channelCreate", type: "boolean", default: "false", description: "Log channel creations" },
              { key: "channelDelete", type: "boolean", default: "false", description: "Log channel deletions" },
              { key: "channelUpdate", type: "boolean", default: "false", description: "Log channel updates (name, topic, etc.)" },
              { key: "roleCreate", type: "boolean", default: "false", description: "Log role creations" },
              { key: "roleDelete", type: "boolean", default: "false", description: "Log role deletions" },
              { key: "roleUpdate", type: "boolean", default: "false", description: "Log role updates (name, perms, color)" },
              { key: "voiceJoin", type: "boolean", default: "false", description: "Log voice channel joins" },
              { key: "voiceLeave", type: "boolean", default: "false", description: "Log voice channel leaves" },
              { key: "voiceMove", type: "boolean", default: "false", description: "Log voice channel switches" },
            ],
          },
        ],
        commands: [
          { trigger: "setserverlogs", aliases: ["serverlogs", "serverlogchannel"], usage: ">setserverlogs", description: "Get a dashboard link to configure server event logging", permissions: "Manage Server" },
          { trigger: "setmodlogs", aliases: ["setlogchannel", "setlogs", "logchannel"], usage: ">setmodlogs <#channel>", description: "Set the channel for mod action logs (Anti-Nuke, AutoMod, etc.)", permissions: "Manage Server" },
        ],
        content: `The **Server Logs** plugin tracks Discord events and posts them to a log channel.

## Two types of logs

NightPigeon has two separate logging systems:

### Mod log channel (\`>setmodlogs\`)
Used for bot-generated events:
- AutoMod deletions and punishments
- Anti-Nuke triggers
- Anti-Raid events

### Server log channel (Dashboard)
Used for Discord events:
- Message edits and deletes
- Member joins/leaves/bans
- Nickname and role changes
- Channel and role creation/deletion
- Voice channel activity

## Configuration

Server log settings are managed through the dashboard. Run \`>setserverlogs\` for a direct link.

You can:
- Pick a single channel for all events
- Enable/disable individual event categories
- Route different categories to different channels`,
      },
      {
        id: "plugin-mute-config",
        title: "Mute Configuration",
        type: "plugin",
        configKey: "muteConfig",
        defaultConfig: `# Mute is configured via bot commands.
#
#   >muteconfig                  — show current settings
#   >muteconfig mode timeout     — use Discord Timeout (default)
#   >muteconfig mode role        — use a Mute Role
#   >muteconfig role create      — auto-create the Muted role
#   >muteconfig role set @Muted  — use an existing role
#   >muteconfig striproles on    — strip all roles on mute`,
        schema: [
          { key: "mode", type: "timeout | role", default: "timeout", description: "How mutes are applied — Discord Timeout or a dedicated Mute Role" },
          { key: "muteRoleId", type: "string | null", default: "null", description: "Role ID to use as the mute role (only used when mode is 'role')" },
          { key: "stripRoles", type: "boolean", default: "false", description: "When true, all roles are removed from the member on mute and restored on unmute (role mode only)" },
        ],
        commands: [
          { trigger: "muteconfig", aliases: ["mutesettings"], usage: ">muteconfig", description: "Show current mute configuration", permissions: "Manage Roles" },
          { trigger: "muteconfig", aliases: ["mutesettings"], usage: ">muteconfig mode timeout", description: "Use Discord's native Timeout (default)", permissions: "Manage Roles" },
          { trigger: "muteconfig", aliases: ["mutesettings"], usage: ">muteconfig mode role", description: "Switch to role-based muting", permissions: "Manage Roles" },
          { trigger: "muteconfig", aliases: ["mutesettings"], usage: ">muteconfig role create", description: "Create a 'Muted' role with channel deny overrides automatically applied", permissions: "Manage Roles + Manage Channels" },
          { trigger: "muteconfig", aliases: ["mutesettings"], usage: ">muteconfig role set @role", description: "Set an existing role as the mute role", permissions: "Manage Roles" },
          { trigger: "muteconfig", aliases: ["mutesettings"], usage: ">muteconfig striproles on|off", description: "Toggle role stripping on mute (role mode only)", permissions: "Manage Roles" },
        ],
        content: `The **Mute Configuration** plugin controls how mutes are applied across the server.

## Modes

### Discord Timeout (default)

Uses Discord's built-in timeout feature. No role setup required.

- Works out of the box
- Muted users cannot send messages, react, or join voice channels
- Max timeout duration is 28 days

### Mute Role

Uses a dedicated role with channel permission overrides.

- More flexible — you control exactly what muted users can see
- Allows permanent mutes
- Supports role stripping (removes all other roles for the duration)

## Setting up role mode

### Option A — Auto-create

\`\`\`
>muteconfig role create
>muteconfig mode role
\`\`\`

The bot creates a "Muted" role and automatically applies deny overrides for **Send Messages**, **Add Reactions**, **Speak**, and **Connect** across all channels.

### Option B — Use existing role

\`\`\`
>muteconfig role set @YourMutedRole
>muteconfig mode role
\`\`\`

## Strip roles

When striproles is on, the bot removes ALL of the member's roles when muting them (and stores them for restoration on unmute). This prevents muted users from bypassing the mute with higher-permission roles.

Only works in role mode.`,
      },
      {
        id: "plugin-shortcuts",
        title: "Shortcuts",
        type: "plugin",
        configKey: "shortcuts",
        defaultConfig: `# Shortcuts are configured via bot commands.
#
#   >shortcut warn  spam    Spamming in chat
#   >shortcut mute  1h      toxic    1h Toxic behaviour
#   >shortcut kick  advert  Advertising
#   >shortcut ban   cheat   Cheating / exploiting
#   >shortcut list
#   >shortcut delete spam`,
        schema: [
          { key: "name", type: "string", description: "The shortcut trigger word — becomes a command in your server" },
          { key: "type", type: "warn | mute | kick | ban", description: "The punishment type this shortcut applies" },
          { key: "reason", type: "string", description: "The reason automatically attached to the punishment" },
          { key: "duration", type: "duration string", description: "Duration for mute/ban shortcuts (optional — omit for permanent)" },
        ],
        commands: [
          { trigger: "shortcut", aliases: ["sc"], usage: ">shortcut warn <name> <reason>", description: "Create a warn shortcut", permissions: "Moderate Members", examples: [">shortcut warn spam Spamming in chat"] },
          { trigger: "shortcut", aliases: ["sc"], usage: ">shortcut mute <name> [duration] <reason>", description: "Create a mute shortcut", permissions: "Moderate Members", examples: [">shortcut mute toxic 1h Toxic behaviour"] },
          { trigger: "shortcut", aliases: ["sc"], usage: ">shortcut kick <name> <reason>", description: "Create a kick shortcut", permissions: "Moderate Members", examples: [">shortcut kick advert Advertising"] },
          { trigger: "shortcut", aliases: ["sc"], usage: ">shortcut ban <name> [duration] <reason>", description: "Create a ban shortcut", permissions: "Moderate Members", examples: [">shortcut ban cheat Cheating", ">shortcut ban 7d tempban Temporary ban"] },
          { trigger: "shortcut", aliases: ["sc"], usage: ">shortcut list", description: "List all shortcuts for this server", permissions: "Moderate Members" },
          { trigger: "shortcut", aliases: ["sc"], usage: ">shortcut delete <name>", description: "Delete a shortcut", permissions: "Moderate Members" },
        ],
        content: `The **Shortcuts** plugin lets you define one-word punishment commands for your staff.

## How shortcuts work

Once created, a shortcut becomes a real command in your server. For example:

\`\`\`
>shortcut mute toxic 1h Toxic behaviour
\`\`\`

Staff can now run:
\`\`\`
>toxic @User
\`\`\`

This instantly mutes the user for 1 hour with the reason "Toxic behaviour". No typing out the full command.

## Limits

- Maximum **50 shortcuts** per server
- Shortcut names are case-insensitive
- Names cannot clash with built-in command names

## Example shortcut set

\`\`\`
>shortcut warn spam       Spamming in chat
>shortcut warn caps       Excessive caps
>shortcut warn off-topic  Off-topic posting
>shortcut mute  1h  toxic      1h Toxic behaviour
>shortcut mute  24h flood      24h Flooding channels
>shortcut mute  7d  repeat     7d Repeated violations
>shortcut kick  advert    Advertising other servers
>shortcut kick  nsfw-pf   NSFW profile picture
>shortcut ban   cheat     Cheating / exploiting
>shortcut ban   slur      Slurs / hate speech
>shortcut ban   7d tempban  Temporary ban
\`\`\`

Staff run: \`>spam @user\`, \`>toxic @user\`, \`>cheat @user\`, etc.`,
      },
      {
        id: "plugin-aliases",
        title: "Command Aliases",
        type: "plugin",
        configKey: "aliases",
        defaultConfig: `# Aliases are configured via bot commands.
#
#   >alias add b   ban
#   >alias add k   kick
#   >alias add an  antinuke
#   >alias list
#   >alias remove b`,
        schema: [
          { key: "alias", type: "string", description: "The alias trigger — the short name you type" },
          { key: "command", type: "string", description: "The built-in command name this alias maps to" },
        ],
        commands: [
          { trigger: "alias", aliases: [], usage: ">alias add <alias> <command>", description: "Create an alias for a command", permissions: "Administrator", examples: [">alias add b ban", ">alias add k kick"] },
          { trigger: "alias", aliases: [], usage: ">alias remove <alias>", description: "Remove an alias", permissions: "Administrator", examples: [">alias remove b"] },
          { trigger: "alias", aliases: [], usage: ">alias list", description: "List all configured aliases", permissions: "Administrator" },
        ],
        content: `The **Command Aliases** plugin lets you create short alternative names for any built-in command.

## Difference from shortcuts

| | Shortcuts | Aliases |
|--|-----------|---------|
| Purpose | Apply a preset punishment | Redirect to another command |
| Usage | \`>spam @user\` | \`>b @user ban reason\` |
| Args | Pre-set (reason, duration) | Full command args still required |

## Example aliases

\`\`\`
>alias add b    ban
>alias add k    kick
>alias add an   antinuke
>alias add ar   antiraid
>alias add bk   backup
>alias add rc   resetconfig
\`\`\`

With these set, \`>b @user Spamming\` works exactly like \`>ban @user Spamming\`.

## Limits

- Each built-in command can have at most **10 aliases**
- Aliases cannot overwrite existing command names`,
      },
    ],
  },
];
