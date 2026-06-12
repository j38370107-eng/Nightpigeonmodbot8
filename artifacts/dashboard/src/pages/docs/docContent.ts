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
  {
    id: "general",
    title: "General",
    pages: [
      {
        id: "introduction",
        title: "Introduction",
        type: "article",
        content: `# Introduction

**NightPigeon** is a private, feature-rich moderation and utility bot for Discord, designed with large servers and reliability in mind.

## What is NightPigeon?

NightPigeon provides a comprehensive suite of tools for Discord server administrators and moderators, including:

- **Moderation** — Ban, kick, mute, warn, and manage cases with a full infraction history
- **Auto-moderation** — Automatic detection and action for spam, bad words, and invite links
- **Security** — Anti-nuke and anti-raid systems to protect your server
- **Logging** — Detailed logs for messages, members, channels, and more
- **Utility** — Tags, reminders, role management, slowmode control, and much more
- **Configuration** — Flexible YAML-based configuration with per-plugin settings and permission levels

## Getting Started

1. Invite the bot to your server using the invite link on the home page
2. Open the **Dashboard** and select your server
3. Navigate to the **Config** tab to set up your YAML configuration
4. Enable and configure the plugins you want to use

## Dashboard

The web dashboard allows you to manage all settings visually without editing YAML directly. You can access the dashboard by logging in with Discord and selecting your server.

## Support

If you run into any issues, join the official Discord server for help.`,
      },
    ],
  },
  {
    id: "configuration",
    title: "Configuration",
    pages: [
      {
        id: "configuration-format",
        title: "Configuration format",
        type: "article",
        content: `# Configuration Format

NightPigeon uses **YAML** for its server configuration. Configuration is stored per-guild and can be edited in the Dashboard's Config tab.

## Basic Structure

\`\`\`yaml
# The command prefix used by the bot in this server
prefix: "!"

# Permission levels for users, roles, and commands
levels:
  users:
    "123456789012345678": 100   # User ID: level
  roles:
    "111222333444555666": 50    # Role ID: level
  commands:
    ban: 50
    kick: 25
    warn: 25

# Plugin configurations
plugins:
  moderation:
    enabled: true
    mute_role: 111222333444555666
    dm_on_action: true
\`\`\`

## Top-Level Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| \`prefix\` | string | \`!\` | The command prefix for this server |
| \`levels\` | object | — | Permission level assignments |
| \`plugins\` | object | — | Per-plugin configuration blocks |

## YAML Tips

- Use quotes around Discord IDs (they are large numbers and may lose precision)
- Indentation must be consistent — use 2 spaces, not tabs
- Comments start with \`#\`
- Boolean values: \`true\` / \`false\` (lowercase)
- Use \`null\` or omit a key to use the default value`,
      },
      {
        id: "plugin-configuration",
        title: "Plugin configuration",
        type: "article",
        content: `# Plugin Configuration

Each plugin has its own configuration block under the \`plugins:\` key.

## Enabling a Plugin

To enable a plugin with its default settings:

\`\`\`yaml
plugins:
  moderation: {}
\`\`\`

To enable with custom settings:

\`\`\`yaml
plugins:
  moderation:
    enabled: true
    mute_role: "111222333444555666"
    dm_on_action: true
\`\`\`

## Plugin Config Keys

Each plugin documentation page lists:
- **Name in config** — the key to use under \`plugins:\`
- **Default configuration** — what the plugin uses when no config is specified
- **Config schema** — all available options with their types and descriptions

## Example: Multiple Plugins

\`\`\`yaml
plugins:
  moderation:
    enabled: true
    mute_role: "111222333444555666"

  automod:
    enabled: true
    log_channel: "999888777666555444"

  logs:
    enabled: true
    log_channel: "999888777666555444"
    categories:
      - message_delete
      - member_join
      - member_leave
\`\`\``,
      },
      {
        id: "permissions",
        title: "Permissions",
        type: "article",
        content: `# Permissions

NightPigeon uses a numeric permission level system. Higher numbers mean more permissions.

## Level Scale

| Level | Typical Role |
|-------|-------------|
| 0 | Everyone (default) |
| 25 | Trusted Member |
| 50 | Moderator |
| 75 | Senior Moderator |
| 100 | Administrator / Owner |

## Assigning Levels

Levels can be assigned to individual users or Discord roles:

\`\`\`yaml
levels:
  users:
    "123456789012345678": 100   # Owner
    "987654321098765432": 75    # Senior Mod
  roles:
    "111222333444555666": 50    # Moderator role
    "222333444555666777": 25    # Trusted role
\`\`\`

## Command Requirements

Each command requires a minimum permission level:

\`\`\`yaml
levels:
  commands:
    ban: 50
    kick: 50
    warn: 25
    mute: 25
    purge: 25
    tag: 25
\`\`\`

## How Levels Are Resolved

1. Check if the user has a direct user-level assignment
2. Check all roles the user has, take the highest role level
3. Server owner always gets level 100
4. Bot owner gets level 100 in all servers

The highest applicable level is used.`,
      },
    ],
  },
  {
    id: "reference",
    title: "Reference",
    pages: [
      {
        id: "argument-types",
        title: "Argument types",
        type: "article",
        content: `# Argument Types

Command arguments use specific types. This page documents all available argument types.

## Basic Types

| Type | Example | Description |
|------|---------|-------------|
| \`string\` | \`hello world\` | Plain text |
| \`number\` | \`42\` | Integer or decimal |
| \`boolean\` | \`true\` / \`false\` | On/off value |
| \`duration\` | \`1h30m\` | Time duration |

## Duration Format

Durations combine a number and a unit letter:

| Unit | Letter | Example |
|------|--------|---------|
| Seconds | \`s\` | \`30s\` |
| Minutes | \`m\` | \`5m\` |
| Hours | \`h\` | \`2h\` |
| Days | \`d\` | \`7d\` |
| Weeks | \`w\` | \`2w\` |

You can combine them: \`1d12h30m\`

## Discord Types

| Type | Example | Description |
|------|---------|-------------|
| \`user\` | \`@User\` or \`123456789\` | A Discord user (mention or ID) |
| \`role\` | \`@Role\` or ID | A Discord role (mention or ID) |
| \`channel\` | \`#channel\` or ID | A Discord channel (mention or ID) |
| \`message\` | Message ID or URL | A specific message |

## Optional vs Required

- **Required** arguments are shown without brackets: \`<user>\`
- **Optional** arguments are shown with brackets: \`[reason]\`
- **Rest** arguments capture everything remaining: \`<reason...>\``,
      },
    ],
  },
  {
    id: "setup-guides",
    title: "Setup guides",
    pages: [
      {
        id: "setup-logs",
        title: "Logs",
        type: "article",
        content: `# Setting Up Logs

Server logging lets you track events like message edits, deletions, member joins, and more.

## Step 1: Create a Log Channel

Create a dedicated text channel in your Discord server for logs (e.g., \`#server-logs\`). Copy the channel ID.

## Step 2: Enable the Logs Plugin

Add the following to your config:

\`\`\`yaml
plugins:
  logs:
    enabled: true
    log_channel: "YOUR_CHANNEL_ID_HERE"
    categories:
      - message_delete
      - message_edit
      - member_join
      - member_leave
      - member_ban
      - member_unban
      - channel_create
      - channel_delete
      - role_create
      - role_delete
\`\`\`

## Step 3: Choose Categories

Pick from the available log categories:

| Category | What it logs |
|----------|-------------|
| \`message_delete\` | Deleted messages |
| \`message_edit\` | Edited messages (before/after) |
| \`member_join\` | Member joins with account age |
| \`member_leave\` | Member leaves / kicks |
| \`member_ban\` | Bans |
| \`member_unban\` | Unbans |
| \`channel_create\` | New channels created |
| \`channel_delete\` | Channels deleted |
| \`role_create\` | New roles |
| \`role_delete\` | Deleted roles |
| \`voice_join\` | Voice channel joins |
| \`voice_leave\` | Voice channel leaves |

## Multiple Log Channels

You can route different log types to separate channels by configuring multiple log channel overrides in the Logs plugin config.`,
      },
      {
        id: "setup-moderation",
        title: "Moderation",
        type: "article",
        content: `# Setting Up Moderation

This guide walks you through setting up the full moderation system.

## Step 1: Create a Mute Role

1. Create a role called \`Muted\` (or any name you prefer)
2. For each channel you want muted users to be silent in, go to channel permissions and deny **Send Messages** for the Muted role
3. Copy the role ID

## Step 2: Configure the Moderation Plugin

\`\`\`yaml
levels:
  roles:
    "MOD_ROLE_ID": 50
  commands:
    ban: 50
    kick: 50
    warn: 25
    mute: 25
    unmute: 25

plugins:
  moderation:
    enabled: true
    mute_role: "MUTED_ROLE_ID"
    dm_on_action: true
    ban_delete_message_days: 1
\`\`\`

## Step 3: Set Up Mod Log

\`\`\`yaml
plugins:
  logs:
    enabled: true
    log_channel: "MOD_LOG_CHANNEL_ID"
    categories:
      - member_ban
      - member_unban
      - member_kick
\`\`\`

## Available Commands

| Command | Usage | Level |
|---------|-------|-------|
| Ban | \`!ban @user [duration] [reason]\` | 50 |
| Kick | \`!kick @user [reason]\` | 50 |
| Mute | \`!mute @user [duration] [reason]\` | 25 |
| Warn | \`!warn @user <reason>\` | 25 |
| Note | \`!note @user <text>\` | 25 |
| Cases | \`!case <id>\` | 25 |`,
      },
      {
        id: "setup-counters",
        title: "Counters",
        type: "article",
        content: `# Setting Up Counters

Counters let you track custom statistics for your server and automate actions when thresholds are reached.

## Basic Counter Setup

\`\`\`yaml
plugins:
  counters:
    enabled: true
    counters:
      spam_warnings:
        initial_value: 0
        triggers:
          - condition: ">=3"
            action: mute
            duration: 1h
            reason: "Too many spam warnings"
\`\`\`

## Use Cases

- Track the number of warnings before auto-punishing
- Monitor message counts for activity roles
- Count infractions to escalate punishments

## Trigger Conditions

| Condition | Example | Meaning |
|-----------|---------|---------|
| \`>=\` | \`>=5\` | Counter is at least 5 |
| \`==\` | \`==10\` | Counter is exactly 10 |
| \`>\` | \`>3\` | Counter is more than 3 |

## Modifying Counters

Counters can be modified by other plugins (automod, mod actions) or via the \`!counter\` command:

\`\`\`
!counter add spam_warnings @user 1
!counter set spam_warnings @user 0
!counter get spam_warnings @user
\`\`\``,
      },
    ],
  },
  {
    id: "plugins",
    title: "Plugins",
    pages: [
      {
        id: "plugin-auto-delete",
        title: "Auto-delete",
        type: "plugin",
        configKey: "auto_delete",
        defaultConfig: `auto_delete:
  enabled: false
  rules: []`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the auto-delete plugin" },
          {
            key: "rules", type: "array", default: "[]", description: "List of auto-delete rules",
            children: [
              { key: "channel", type: "string", description: "Channel ID to apply the rule to" },
              { key: "delay", type: "duration", default: "30s", description: "How long after posting to delete the message" },
              { key: "match_bots", type: "boolean", default: "false", description: "Also delete bot messages" },
            ],
          },
        ],
        commands: [
          { trigger: "!autodelete", usage: "!autodelete [channel] [delay]", description: "Temporarily enable auto-delete in a channel", permissions: "50" },
        ],
        content: `The **Auto-delete** plugin automatically deletes messages in specified channels after a configurable delay.

## Use Cases

- Keep \`#bot-commands\` channels clean by deleting responses after 30 seconds
- Auto-clean \`#verification\` channels
- Remove bot output in announcement channels`,
      },
      {
        id: "plugin-auto-reactions",
        title: "Auto-reactions",
        type: "plugin",
        configKey: "auto_reactions",
        defaultConfig: `auto_reactions:
  enabled: false
  triggers: []`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the auto-reactions plugin" },
          {
            key: "triggers", type: "array", default: "[]", description: "List of auto-reaction triggers",
            children: [
              { key: "channel", type: "string", description: "Channel ID to apply reactions to" },
              { key: "emojis", type: "string[]", description: "List of emoji to add (unicode or custom ID)" },
              { key: "match_bots", type: "boolean", default: "false", description: "Also react to bot messages" },
            ],
          },
        ],
        content: `The **Auto-reactions** plugin automatically adds emoji reactions to messages in specified channels.

## Use Cases

- Add upvote/downvote reactions to \`#suggestions\`
- React with a ✅ to \`#rules-accepted\` messages
- Add fun reactions to \`#memes\``,
      },
      {
        id: "plugin-automod",
        title: "Automod",
        type: "plugin",
        configKey: "automod",
        defaultConfig: `automod:
  enabled: false
  log_channel: null
  rules: []`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the automod plugin" },
          { key: "log_channel", type: "string | null", default: "null", description: "Channel ID to log automod actions" },
          {
            key: "rules", type: "array", default: "[]", description: "List of automod rules",
            children: [
              { key: "name", type: "string", description: "Friendly name for the rule" },
              { key: "triggers", type: "object[]", description: "What triggers this rule (word_list, spam, invite_links, etc.)" },
              { key: "actions", type: "object[]", description: "What to do when triggered (delete, warn, mute, ban, etc.)" },
              { key: "ignore_roles", type: "string[]", default: "[]", description: "Roles to exempt from this rule" },
              { key: "ignore_channels", type: "string[]", default: "[]", description: "Channels to exempt from this rule" },
            ],
          },
        ],
        commands: [],
        content: `The **Automod** plugin provides automated moderation rules that detect and act on rule-breaking content without requiring manual moderator intervention.

## Trigger Types

| Trigger | Description |
|---------|-------------|
| \`word_list\` | Matches messages containing specified words or phrases |
| \`invite_links\` | Detects Discord invite links |
| \`spam\` | Detects rapid message sending |
| \`mention_spam\` | Detects mass-mentions |
| \`attachments\` | Flags messages with attachments |
| \`links\` | Detects any URLs |

## Action Types

| Action | Description |
|--------|-------------|
| \`delete\` | Delete the offending message |
| \`warn\` | Add a warning to the user's case history |
| \`mute\` | Mute the user for a duration |
| \`ban\` | Ban the user |
| \`log\` | Log the detection without punishing |`,
      },
      {
        id: "plugin-cases",
        title: "Cases",
        type: "plugin",
        configKey: "cases",
        defaultConfig: `cases:
  enabled: true
  log_channel: null`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the cases plugin" },
          { key: "log_channel", type: "string | null", default: "null", description: "Channel to post case logs to" },
        ],
        commands: [
          { trigger: "!case", aliases: ["!c"], usage: "!case <id>", description: "View details of a specific moderation case", permissions: "25", examples: ["!case 42"] },
          { trigger: "!cases", usage: "!cases @user", description: "View all cases for a user", permissions: "25", examples: ["!cases @User"] },
          { trigger: "!deletecase", usage: "!deletecase <id>", description: "Delete a moderation case", permissions: "75" },
          { trigger: "!editcase", usage: "!editcase <id> <new reason>", description: "Edit the reason for a case", permissions: "50" },
          { trigger: "!note", usage: "!note @user <text>", description: "Add a staff note to a user's record (not shown to user)", permissions: "25" },
        ],
        content: `The **Cases** plugin tracks all moderation actions as numbered cases. Every ban, kick, mute, and warn creates a case entry.

## Case Types

| Type | Description |
|------|-------------|
| \`ban\` | User was banned |
| \`unban\` | User was unbanned |
| \`kick\` | User was kicked |
| \`mute\` | User was muted |
| \`unmute\` | User was unmuted |
| \`warn\` | User received a warning |
| \`note\` | Staff note (not shown to user) |

## Viewing Cases

Use \`!cases @user\` to see a numbered list of all infractions. Each case shows the type, reason, moderator, and timestamp.`,
      },
      {
        id: "plugin-command-aliases",
        title: "Command Aliases",
        type: "plugin",
        configKey: "command_aliases",
        defaultConfig: `command_aliases:
  enabled: false
  aliases: []`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable command aliases" },
          {
            key: "aliases", type: "array", default: "[]", description: "List of alias definitions",
            children: [
              { key: "match", type: "string", description: "The alias trigger (e.g. !b)" },
              { key: "expand_to", type: "string", description: "The command it expands to (e.g. !ban)" },
            ],
          },
        ],
        content: `The **Command Aliases** plugin lets you create shorthand aliases for any bot command.

## Examples

\`\`\`yaml
plugins:
  command_aliases:
    enabled: true
    aliases:
      - match: "!b"
        expand_to: "!ban"
      - match: "!k"
        expand_to: "!kick"
      - match: "!m"
        expand_to: "!mute"
      - match: "!w"
        expand_to: "!warn"
\`\`\`

With this config, \`!b @user Spamming\` is identical to \`!ban @user Spamming\`.`,
      },
      {
        id: "plugin-common",
        title: "Common",
        type: "plugin",
        configKey: "common",
        defaultConfig: `common:
  enabled: true`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable common utility commands" },
        ],
        commands: [
          { trigger: "!help", usage: "!help [command]", description: "Show bot help or help for a specific command", permissions: "0" },
          { trigger: "!ping", usage: "!ping", description: "Check the bot's latency", permissions: "0" },
          { trigger: "!info", usage: "!info", description: "Show bot version and stats", permissions: "0" },
          { trigger: "!avatar", usage: "!avatar [@user]", description: "Show a user's avatar", permissions: "0" },
          { trigger: "!serverinfo", usage: "!serverinfo", description: "Show server information", permissions: "0" },
          { trigger: "!userinfo", usage: "!userinfo [@user]", description: "Show information about a user", permissions: "25" },
        ],
        content: `The **Common** plugin provides basic utility commands available in every server.`,
      },
      {
        id: "plugin-companion-channels",
        title: "Companion channels",
        type: "plugin",
        configKey: "companion_channels",
        defaultConfig: `companion_channels:
  enabled: false
  pairs: []`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable companion channels" },
          {
            key: "pairs", type: "array", default: "[]", description: "List of companion channel pairs",
            children: [
              { key: "voice_channel", type: "string", description: "Voice channel ID" },
              { key: "text_channel", type: "string", description: "Text channel ID to show when someone joins the voice channel" },
            ],
          },
        ],
        content: `The **Companion channels** plugin automatically shows or hides text channels based on voice channel membership.

## Use Cases

- Give each voice channel its own private text channel
- Only show a gaming text channel when users are in the gaming voice channel`,
      },
      {
        id: "plugin-context-menu",
        title: "Context menu",
        type: "plugin",
        configKey: "context_menu",
        defaultConfig: `context_menu:
  can_use: false
  can_open_mod_menu: false`,
        schema: [
          { key: "can_use", type: "boolean", default: "false", description: "Allow members to use context menu actions" },
          { key: "can_open_mod_menu", type: "boolean", default: "false", description: "Allow moderators to open the moderation context menu on users" },
        ],
        content: `The **Context menu** plugin adds right-click context menu actions to the bot.

## Usage

Right-click (or long-press on mobile) a user's message to access bot actions such as quick-warn, lookup, or mod menu.`,
      },
      {
        id: "plugin-counters",
        title: "Counters",
        type: "plugin",
        configKey: "counters",
        defaultConfig: `counters:
  enabled: false
  counters: {}`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the counters plugin" },
          {
            key: "counters", type: "object", default: "{}", description: "Map of counter name to counter config",
            children: [
              { key: "initial_value", type: "number", default: "0", description: "Starting value for the counter" },
              {
                key: "triggers", type: "array", default: "[]", description: "Threshold triggers",
                children: [
                  { key: "condition", type: "string", description: "Condition expression (e.g. >=3)" },
                  { key: "action", type: "string", description: "Action to take (mute, ban, kick, warn)" },
                  { key: "duration", type: "duration", description: "Duration for timed actions like mute" },
                  { key: "reason", type: "string", description: "Reason used for the action" },
                ],
              },
            ],
          },
        ],
        commands: [
          { trigger: "!counter", usage: "!counter <get|set|add> <name> @user [value]", description: "Manage counter values for users", permissions: "25" },
        ],
        content: `The **Counters** plugin lets you define custom numeric counters per user and trigger automated actions when thresholds are reached.`,
      },
      {
        id: "plugin-locate-user",
        title: "Locate user",
        type: "plugin",
        configKey: "locate_user",
        defaultConfig: `locate_user:
  enabled: false`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the locate user plugin" },
        ],
        commands: [
          { trigger: "!locate", usage: "!locate <user ID>", description: "Look up a user's servers (shared with the bot) and profile information", permissions: "75", examples: ["!locate 123456789012345678"] },
          { trigger: "!whois", usage: "!whois <user ID>", description: "Get detailed information about a Discord user by ID", permissions: "50" },
        ],
        content: `The **Locate user** plugin provides tools to look up Discord users by ID and find information about them across servers the bot is in.

## Use Cases

- Identify alts by looking up an account's shared servers
- Look up banned users by ID without being in the same server
- Cross-reference suspicious accounts`,
      },
      {
        id: "plugin-logs",
        title: "Logs",
        type: "plugin",
        configKey: "logs",
        defaultConfig: `logs:
  enabled: false
  log_channel: null
  categories:
    - message_delete
    - message_edit
    - member_join
    - member_leave`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the logs plugin" },
          { key: "log_channel", type: "string | null", default: "null", description: "Default channel ID for all log types" },
          { key: "categories", type: "string[]", default: "[]", description: "List of event categories to log" },
        ],
        content: `The **Logs** plugin sends structured log embeds to a designated channel whenever configured server events occur.

## Available Categories

| Category | Description |
|----------|-------------|
| \`message_delete\` | Deleted messages with content |
| \`message_edit\` | Edited messages showing before/after |
| \`member_join\` | New member joins with account age warning |
| \`member_leave\` | Members leaving or being kicked |
| \`member_ban\` | Members being banned |
| \`member_unban\` | Members being unbanned |
| \`role_add\` | Roles added to members |
| \`role_remove\` | Roles removed from members |
| \`channel_create\` | Channels being created |
| \`channel_delete\` | Channels being deleted |
| \`voice_join\` | Voice channel joins |
| \`voice_leave\` | Voice channel leaves |
| \`voice_move\` | Moving between voice channels |`,
      },
      {
        id: "plugin-mod-actions",
        title: "Mod actions",
        type: "plugin",
        configKey: "moderation",
        defaultConfig: `moderation:
  enabled: false
  mute_role: null
  dm_on_action: true
  mute_remove_roles: false
  ban_delete_message_days: 1`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the moderation plugin" },
          { key: "mute_role", type: "string | null", default: "null", description: "Role ID to apply when muting a user" },
          { key: "dm_on_action", type: "boolean", default: "true", description: "DM the user when a moderation action is taken" },
          { key: "mute_remove_roles", type: "boolean", default: "false", description: "Remove all roles when muting and restore on unmute" },
          { key: "ban_delete_message_days", type: "number", default: "1", description: "Number of days of messages to delete on ban (0–7)" },
        ],
        commands: [
          { trigger: "!ban", usage: "!ban @user [duration] [reason]", description: "Ban a user from the server", permissions: "50", examples: ["!ban @User Spamming", "!ban @User 7d Repeated violations"] },
          { trigger: "!unban", usage: "!unban <user ID> [reason]", description: "Unban a user", permissions: "50" },
          { trigger: "!kick", usage: "!kick @user [reason]", description: "Kick a user from the server", permissions: "50" },
          { trigger: "!mute", usage: "!mute @user [duration] [reason]", description: "Mute a user", permissions: "25", examples: ["!mute @User 1h Spamming"] },
          { trigger: "!unmute", usage: "!unmute @user [reason]", description: "Unmute a user", permissions: "25" },
          { trigger: "!warn", usage: "!warn @user <reason>", description: "Warn a user", permissions: "25" },
          { trigger: "!forceban", usage: "!forceban <user ID> [reason]", description: "Ban a user by ID even if they are not in the server", permissions: "50" },
        ],
        content: `The **Mod actions** plugin provides the core set of moderation commands for managing users in your server.`,
      },
      {
        id: "plugin-mutes",
        title: "Mutes",
        type: "plugin",
        configKey: "mutes",
        defaultConfig: `mutes:
  enabled: true
  mute_role: null
  move_to_voice_channel: null`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the mutes plugin" },
          { key: "mute_role", type: "string | null", default: "null", description: "Override the mute role (defaults to moderation plugin's mute_role)" },
          { key: "move_to_voice_channel", type: "string | null", default: "null", description: "Move muted users to this voice channel ID" },
        ],
        commands: [
          { trigger: "!mute", usage: "!mute @user [duration] [reason]", description: "Mute a user", permissions: "25" },
          { trigger: "!unmute", usage: "!unmute @user [reason]", description: "Remove a user's mute", permissions: "25" },
          { trigger: "!mutes", usage: "!mutes", description: "List all currently active mutes", permissions: "25" },
        ],
        content: `The **Mutes** plugin manages temporary and permanent mutes. Mutes automatically expire if a duration is specified, even if the bot restarts.`,
      },
      {
        id: "plugin-persist",
        title: "Persist",
        type: "plugin",
        configKey: "persist",
        defaultConfig: `persist:
  enabled: false
  persist_roles: true
  persist_nickname: false`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the persist plugin" },
          { key: "persist_roles", type: "boolean", default: "true", description: "Re-apply a user's roles when they rejoin" },
          { key: "persist_nickname", type: "boolean", default: "false", description: "Re-apply the user's nickname when they rejoin" },
        ],
        content: `The **Persist** plugin saves member data when they leave and restores it when they rejoin. This is most commonly used to keep mutes active even if a user leaves and rejoins to bypass them.

## Anti-Mute-Bypass

With \`persist_roles: true\`, if a muted user leaves and rejoins, the mute role is automatically reapplied.`,
      },
      {
        id: "plugin-pingable-roles",
        title: "Pingable roles",
        type: "plugin",
        configKey: "pingable_roles",
        defaultConfig: `pingable_roles:
  enabled: false
  roles: []`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable pingable roles" },
          {
            key: "roles", type: "array", default: "[]", description: "List of pingable role configs",
            children: [
              { key: "role", type: "string", description: "Role ID to make temporarily pingable" },
              { key: "cooldown", type: "duration", default: "30m", description: "Cooldown between pings" },
              { key: "required_level", type: "number", default: "25", description: "Minimum permission level to ping this role" },
            ],
          },
        ],
        commands: [
          { trigger: "!pingRole", usage: "!pingRole <role>", description: "Temporarily make a role mentionable and ping it", permissions: "25" },
        ],
        content: `The **Pingable roles** plugin lets moderators ping otherwise non-mentionable roles. The bot temporarily enables mentions on the role, pings it, then immediately disables mentions again.`,
      },
      {
        id: "plugin-post",
        title: "Post",
        type: "plugin",
        configKey: "post",
        defaultConfig: `post:
  enabled: false`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the post plugin" },
        ],
        commands: [
          { trigger: "!post", usage: "!post <channel> <message>", description: "Post a message as the bot in a specified channel", permissions: "75" },
          { trigger: "!edit", usage: "!edit <message URL or ID> <new content>", description: "Edit a message the bot previously sent", permissions: "75" },
        ],
        content: `The **Post** plugin lets moderators send and edit messages as the bot in any channel. Useful for announcements, rules, and pinned information.`,
      },
      {
        id: "plugin-reminders",
        title: "Reminders",
        type: "plugin",
        configKey: "reminders",
        defaultConfig: `reminders:
  enabled: true`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the reminders plugin" },
        ],
        commands: [
          { trigger: "!remindme", aliases: ["!remind"], usage: "!remindme <duration> <reminder>", description: "Set a reminder that the bot will DM you after the duration", permissions: "0", examples: ["!remindme 2h Check the oven", "!remindme 1d30m Meeting with team"] },
          { trigger: "!reminders", usage: "!reminders", description: "List your active reminders", permissions: "0" },
          { trigger: "!deletereminder", usage: "!deletereminder <id>", description: "Delete one of your reminders", permissions: "0" },
        ],
        content: `The **Reminders** plugin lets members set personal reminders that the bot delivers via DM.`,
      },
      {
        id: "plugin-role-buttons",
        title: "Role buttons",
        type: "plugin",
        configKey: "role_buttons",
        defaultConfig: `role_buttons:
  enabled: false
  buttons: []`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable role buttons" },
          {
            key: "buttons", type: "array", default: "[]", description: "List of role button configs",
            children: [
              { key: "message_id", type: "string", description: "Message ID to attach buttons to" },
              { key: "channel_id", type: "string", description: "Channel the message is in" },
              { key: "roles", type: "object[]", description: "Roles and their button labels/emojis" },
            ],
          },
        ],
        content: `The **Role buttons** plugin creates interactive Discord buttons that members can click to assign or remove roles from themselves.

## Setup

1. Use \`!post\` to post a message as the bot
2. Copy the message ID
3. Configure role buttons pointing to that message

Members click the buttons to toggle their roles.`,
      },
      {
        id: "plugin-roles",
        title: "Roles",
        type: "plugin",
        configKey: "roles",
        defaultConfig: `roles:
  enabled: false`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the roles plugin" },
        ],
        commands: [
          { trigger: "!role", usage: "!role @user <add|remove> <role>", description: "Add or remove a role from a user", permissions: "50" },
          { trigger: "!massrole", usage: "!massrole <add|remove> <role>", description: "Add or remove a role from all members (use with caution)", permissions: "100" },
        ],
        content: `The **Roles** plugin provides commands for managing Discord roles on members.`,
      },
      {
        id: "plugin-self-grantable-roles",
        title: "Self-grantable roles",
        type: "plugin",
        configKey: "self_grantable_roles",
        defaultConfig: `self_grantable_roles:
  enabled: false
  roles: []`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable self-grantable roles" },
          {
            key: "roles", type: "array", default: "[]", description: "Roles members can give themselves",
            children: [
              { key: "role", type: "string", description: "Role ID" },
              { key: "aliases", type: "string[]", description: "Alternative names to use in the command" },
            ],
          },
        ],
        commands: [
          { trigger: "!role", usage: "!role <role name>", description: "Grant yourself a self-assignable role", permissions: "0" },
          { trigger: "!roles", usage: "!roles", description: "List all self-assignable roles", permissions: "0" },
        ],
        content: `The **Self-grantable roles** plugin lets members assign and remove specific roles themselves without needing staff assistance.`,
      },
      {
        id: "plugin-slowmode",
        title: "Slowmode",
        type: "plugin",
        configKey: "slowmode",
        defaultConfig: `slowmode:
  enabled: false`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the slowmode plugin" },
        ],
        commands: [
          { trigger: "!slowmode", aliases: ["!slow"], usage: "!slowmode [channel] <duration|off>", description: "Set slowmode for a channel, or turn it off", permissions: "25", examples: ["!slowmode 5s", "!slowmode #general 30s", "!slowmode off"] },
        ],
        content: `The **Slowmode** plugin provides commands for quickly setting and clearing Discord's native channel slowmode.`,
      },
      {
        id: "plugin-starboard",
        title: "Starboard",
        type: "plugin",
        configKey: "starboard",
        defaultConfig: `starboard:
  enabled: false
  channel: null
  emoji: "⭐"
  threshold: 3`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the starboard" },
          { key: "channel", type: "string | null", default: "null", description: "Channel ID for the starboard" },
          { key: "emoji", type: "string", default: "⭐", description: "Emoji to count for starring messages" },
          { key: "threshold", type: "number", default: "3", description: "Number of reactions needed to post to the starboard" },
          { key: "ignore_channels", type: "string[]", default: "[]", description: "Channels to exclude from the starboard" },
        ],
        content: `The **Starboard** plugin reposts highly-reacted messages to a dedicated starboard channel, letting the community highlight notable messages.`,
      },
      {
        id: "plugin-tags",
        title: "Tags",
        type: "plugin",
        configKey: "tags",
        defaultConfig: `tags:
  enabled: false
  prefix: "!"`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the tags plugin" },
          { key: "prefix", type: "string", default: "!", description: "Prefix for tag invocation" },
        ],
        commands: [
          { trigger: "!tag", usage: "!tag <name>", description: "Invoke a tag by name", permissions: "0" },
          { trigger: "!tag create", usage: "!tag create <name> <content>", description: "Create a new tag", permissions: "50" },
          { trigger: "!tag edit", usage: "!tag edit <name> <new content>", description: "Edit an existing tag", permissions: "50" },
          { trigger: "!tag delete", usage: "!tag delete <name>", description: "Delete a tag", permissions: "50" },
          { trigger: "!tags", usage: "!tags", description: "List all tags in the server", permissions: "0" },
        ],
        content: `The **Tags** plugin lets moderators create pre-written text snippets (tags) that can be instantly retrieved by anyone. Tags are useful for frequently asked questions and common responses.

## Example

Create a tag for rules:
\`\`\`
!tag create rules Please read #rules before posting.
\`\`\`

Anyone can then use \`!tag rules\` (or \`!rules\` if configured) to retrieve it.`,
      },
      {
        id: "plugin-time-and-date",
        title: "Time and date",
        type: "plugin",
        configKey: "time_and_date",
        defaultConfig: `time_and_date:
  enabled: true`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the time and date plugin" },
        ],
        commands: [
          { trigger: "!time", usage: "!time [timezone]", description: "Show the current time in a timezone", permissions: "0", examples: ["!time UTC", "!time America/New_York"] },
          { trigger: "!stamp", usage: "!stamp <date/time> [timezone]", description: "Convert a time to a Discord timestamp", permissions: "0" },
        ],
        content: `The **Time and date** plugin provides commands for looking up times across timezones and generating Discord timestamp formats.`,
      },
      {
        id: "plugin-utility",
        title: "Utility",
        type: "plugin",
        configKey: "utility",
        defaultConfig: `utility:
  enabled: true`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the utility plugin" },
        ],
        commands: [
          { trigger: "!purge", usage: "!purge <count> [@user]", description: "Delete multiple messages at once, optionally filtered to a user", permissions: "25", examples: ["!purge 10", "!purge 50 @User"] },
          { trigger: "!clean", usage: "!clean <count>", description: "Delete bot messages", permissions: "25" },
          { trigger: "!snipe", usage: "!snipe [channel]", description: "Show the most recently deleted message", permissions: "25" },
          { trigger: "!editsnipe", usage: "!editsnipe [channel]", description: "Show the most recently edited message", permissions: "25" },
          { trigger: "!id", usage: "!id [@user | #channel | @role]", description: "Get the Discord ID of a user, channel, or role", permissions: "0" },
          { trigger: "!embed", usage: "!embed <channel> <title> | <description>", description: "Post an embed as the bot", permissions: "75" },
        ],
        content: `The **Utility** plugin provides general-purpose moderation tools like bulk message deletion and message sniping.`,
      },
      {
        id: "plugin-welcome-message",
        title: "Welcome message",
        type: "plugin",
        configKey: "welcome_message",
        defaultConfig: `welcome_message:
  enabled: false
  channel: null
  message: "Welcome to the server, {user}!"
  dm_message: null`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the welcome message plugin" },
          { key: "channel", type: "string | null", default: "null", description: "Channel ID to post the welcome message in" },
          { key: "message", type: "string", default: "Welcome to the server, {user}!", description: "The welcome message. Use {user} for a mention, {username} for name, {server} for server name" },
          { key: "dm_message", type: "string | null", default: "null", description: "Optional DM message to send to new members" },
        ],
        content: `The **Welcome message** plugin sends a message when a new member joins your server.

## Template Variables

| Variable | Replaced With |
|----------|--------------|
| \`{user}\` | Mention of the new member |
| \`{username}\` | Username without mention |
| \`{server}\` | Server name |
| \`{memberCount}\` | Total member count |`,
      },
    ],
  },
];
