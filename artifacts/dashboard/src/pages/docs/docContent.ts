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

NightPigeon is a plugin-based Discord moderation bot inspired by Zeppelin. Every plugin has its own YAML configuration block, and **every single message, embed, DM, and automod response the bot sends can be fully customized** per server through the YAML config.

## Plugins

| Plugin | What it does |
|--------|-------------|
| Moderation | ban, kick, mute, warn, purge, lock, slowmode |
| Mass Actions | masswarn, massmute, massban, etc. |
| Cases | infraction tracking, notes, case history |
| Automod | spam, bad words, invite links, mass mentions, caps, link spam |
| Logging | logs every Discord event to configurable channels |
| Lockdown | channel and server lockdown with presets |
| Anti-Nuke | protection against mass destructive actions |
| Anti-Raid | protection against mass join attacks |
| Tags | custom text commands per server |
| Roles | addrole, removerole, temprole |
| Reaction Roles | emoji-based role panels |
| Welcome | welcome/goodbye messages, join DM, welcome role |
| Starboard | star-pinning system |
| Reminders | personal scheduled reminders |
| Timezones | per-user timezone storage and time commands |
| History | full member history (cases, notes, joins, roles) |
| Levels | manual level/rank tracking |
| Mod Nick | automated nickname moderation |
| Autoreply | trigger-based auto responses |
| Autoreaction | automatic emoji reactions |
| Autoclean | scheduled channel cleaning |
| Slowmode Auto | automatic slowmode based on activity |
| Duration Roles | time-limited role assignments |
| Tickets | support ticket system |
| Utility | userinfo, serverinfo, avatar, and many more |

## Default prefix

\`!\` — change with \`!config set\` in the YAML.`,
      },
      {
        id: "configuration-format",
        title: "Configuration format",
        type: "article",
        content: `# Configuration Format

Each server has its own YAML configuration stored in the database. Edit it from the **Config** tab in the dashboard.

## Basic structure

\`\`\`yaml
prefix: "!"

plugins:
  moderation:
    enabled: true
    mute_role: "123456789012345678"
    dm_on_action: true

  automod:
    enabled: true
    spam:
      enabled: true
      max_messages: 5
      interval_seconds: 5
      action: mute
\`\`\`

## Top-level keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| \`prefix\` | string | \`!\` | Command prefix for this server |
| \`plugins\` | object | — | Per-plugin configuration blocks |

## Enabling a plugin

To enable a plugin with all defaults:

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
\`\`\`

## YAML tips

- Always quote Discord snowflake IDs — they are large numbers
- Use **2 spaces** for indentation, never tabs
- Comments start with \`#\`
- Booleans: \`true\` / \`false\` (lowercase)
- Omit a key to use its default`,
      },
      {
        id: "message-customization",
        title: "Message customization",
        type: "article",
        content: `# Message Customization

Every single message the bot sends can be customized in your YAML config. Each configurable message supports three formats.

## Format 1 — Plain string

\`\`\`yaml
ban_success: "✅ {user.mention} has been banned. Case: #{case_id}"
\`\`\`

## Format 2 — Embed only

\`\`\`yaml
ban_success:
  embed:
    title: "✅ User Banned"
    description: "{user.mention} has been banned by {mod.mention}."
    color: "#FF0000"
    thumbnail: "{user.avatar}"
    footer: "Case #{case_id} • {timestamp}"
    fields:
      - name: "Reason"
        value: "{reason}"
        inline: true
      - name: "Duration"
        value: "{duration}"
        inline: true
    author:
      name: "{server}"
      icon: "{server.icon}"
\`\`\`

## Format 3 — Message + embed

\`\`\`yaml
ban_success:
  content: "{user.mention} you have been banned."
  embed:
    title: "Ban Notice"
    description: "Reason: {reason}"
    color: "#FF0000"
\`\`\`

## Embed fields reference

| Field | Type | Description |
|-------|------|-------------|
| \`title\` | string | Embed title |
| \`description\` | string | Embed body text |
| \`color\` | hex string | e.g. \`"#FF0000"\` |
| \`thumbnail\` | URL | Small image top-right |
| \`image\` | URL | Large image at bottom |
| \`footer\` | string | Footer text |
| \`fields\` | array | List of \`{name, value, inline}\` objects |
| \`author.name\` | string | Author name above title |
| \`author.icon\` | URL | Author icon |

## Template variables

All message templates support these placeholders:

**User**
\`{user}\` \`{user.mention}\` \`{user.id}\` \`{user.name}\` \`{user.avatar}\` \`{user.created_at}\` \`{user.joined_at}\`

**Moderator**
\`{mod}\` \`{mod.mention}\` \`{mod.id}\` \`{mod.name}\`

**Server**
\`{server}\` \`{server.id}\` \`{server.icon}\` \`{server.member_count}\`

**Action**
\`{reason}\` \`{duration}\` \`{case_id}\` \`{action}\` \`{channel}\` \`{channel.mention}\` \`{count}\` \`{expires_at}\`

**Automod**
\`{trigger}\` \`{rule}\`

**Timestamps**
\`{timestamp}\` \`{timestamp.date}\` \`{timestamp.time}\``,
      },
      {
        id: "permissions",
        title: "Permissions",
        type: "article",
        content: `# Permissions

NightPigeon uses a numeric level system. Higher numbers = more access. Level 0 is public, 1000 is bot owner.

## Level scale

| Level | Typical role |
|-------|-------------|
| 0 | Everyone |
| 25 | Trusted member |
| 50 | Moderator |
| 75 | Senior Moderator |
| 100 | Administrator |
| 1000 | Bot owner |

## Assigning levels in YAML

\`\`\`yaml
levels:
  users:
    "123456789012345678": 100
  roles:
    "111222333444555666": 50
    "222333444555666777": 25
  commands:
    ban: 50
    kick: 50
    warn: 25
    mute: 25
    purge: 25
\`\`\`

## Argument types reference

| Type | Example | Description |
|------|---------|-------------|
| \`@user\` | \`@Username\` | Discord user mention |
| \`<user_id>\` | \`123456789\` | Raw Discord user ID (works for banned/left users) |
| \`[duration]\` | \`10m\`, \`1h\`, \`2d\` | Optional duration |
| \`<duration>\` | \`1h\` | Required duration |
| \`[reason]\` | \`Spamming\` | Optional reason (supports preset names) |
| \`#channel\` | \`#general\` | Channel mention |
| \`@role\` | \`@Moderator\` | Role mention |

## Duration format

| Unit | Letter | Example |
|------|--------|---------|
| Seconds | \`s\` | \`30s\` |
| Minutes | \`m\` | \`10m\` |
| Hours | \`h\` | \`1h\` |
| Days | \`d\` | \`7d\` |
| Weeks | \`w\` | \`2w\` |
| Permanent | \`perm\` | \`perm\` |`,
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
      // ── MODERATION ──────────────────────────────────────────────────────────
      {
        id: "plugin-moderation",
        title: "Moderation",
        type: "plugin",
        configKey: "moderation",
        defaultConfig: `moderation:
  enabled: true
  mute_role: null
  dm_on_action: true
  strip_roles_on_mute: false
  dm_mute_updates: false
  messages:
    ban_success:
      embed:
        title: "✅ User Banned"
        description: "{user.mention} has been banned by {mod.mention}."
        color: "#FF0000"
        fields:
          - name: "Reason"
            value: "{reason}"
            inline: true
          - name: "Case"
            value: "#{case_id}"
            inline: true
        footer: "{timestamp}"
    unban_success:
      embed:
        title: "✅ User Unbanned"
        description: "{user.mention} has been unbanned."
        color: "#00FF00"
    kick_success:
      embed:
        title: "✅ User Kicked"
        description: "{user.mention} has been kicked."
        color: "#FFA500"
    mute_success:
      embed:
        title: "✅ User Muted"
        description: "{user.mention} has been muted."
        color: "#FFA500"
        fields:
          - name: "Duration"
            value: "{duration}"
            inline: true
          - name: "Expires"
            value: "{expires_at}"
            inline: true
    unmute_success:
      embed:
        title: "✅ User Unmuted"
        description: "{user.mention} has been unmuted."
        color: "#00FF00"
    warn_success:
      embed:
        title: "⚠️ User Warned"
        description: "{user.mention} has been warned."
        color: "#FFFF00"
        fields:
          - name: "Reason"
            value: "{reason}"
            inline: true
          - name: "Total Warnings"
            value: "{count}"
            inline: true
    purge_success: "🗑️ Deleted {count} messages."
    slowmode_success: "⏱️ Slowmode set to {count}s in {channel.mention}."
    ban_dm:
      embed:
        title: "You have been banned"
        description: "You were banned from **{server}**."
        color: "#FF0000"
        fields:
          - name: "Reason"
            value: "{reason}"
          - name: "Moderator"
            value: "{mod}"
            inline: true
        footer: "Case #{case_id}"
    kick_dm:
      embed:
        title: "You have been kicked"
        description: "You were kicked from **{server}**."
        color: "#FFA500"
    mute_dm:
      embed:
        title: "You have been muted"
        description: "You were muted in **{server}**."
        color: "#FFA500"
        fields:
          - name: "Duration"
            value: "{duration}"
            inline: true
          - name: "Expires"
            value: "{expires_at}"
            inline: true
    warn_dm:
      embed:
        title: "You have been warned"
        description: "You received a warning in **{server}**."
        color: "#FFFF00"
    error_no_permission: "❌ You don't have permission to use this command."
    error_user_not_found: "❌ User not found."
    error_already_muted: "❌ {user.mention} is already muted."
    error_not_muted: "❌ {user.mention} is not muted."
    error_cannot_action_self: "❌ You cannot {action} yourself."
    error_cannot_action_bot: "❌ You cannot {action} the bot."
    error_hierarchy: "❌ You cannot {action} someone with a higher or equal role."`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the moderation plugin" },
          { key: "mute_role", type: "snowflake | null", default: "null", description: "Role ID to apply when muting a member" },
          { key: "dm_on_action", type: "boolean", default: "true", description: "DM the user when a moderation action is taken against them" },
          { key: "strip_roles_on_mute", type: "boolean", default: "false", description: "Remove all roles from a member when muted; restore them on unmute" },
          { key: "dm_mute_updates", type: "boolean", default: "false", description: "DM the user when their mute time is updated or approaching expiry" },
          {
            key: "messages", type: "object", description: "Customizable response messages. Every key supports plain string, embed, or content+embed format.",
            children: [
              { key: "ban_success", type: "message", description: "Posted in channel when a user is banned. Variables: {user} {mod} {reason} {duration} {case_id}" },
              { key: "unban_success", type: "message", description: "Posted when a user is unbanned." },
              { key: "kick_success", type: "message", description: "Posted when a user is kicked." },
              { key: "mute_success", type: "message", description: "Posted when a user is muted. Variables: {duration} {expires_at}" },
              { key: "unmute_success", type: "message", description: "Posted when a user is unmuted." },
              { key: "warn_success", type: "message", description: "Posted when a user is warned. Variables: {count} = total warn count" },
              { key: "purge_success", type: "message", description: "Posted after purge. Variable: {count} = messages deleted" },
              { key: "slowmode_success", type: "message", description: "Posted when slowmode is set. Variables: {count} {channel.mention}" },
              { key: "ban_dm", type: "message", description: "DM sent to banned user" },
              { key: "unban_dm", type: "message", description: "DM sent to unbanned user" },
              { key: "kick_dm", type: "message", description: "DM sent to kicked user" },
              { key: "mute_dm", type: "message", description: "DM sent to muted user" },
              { key: "unmute_dm", type: "message", description: "DM sent to unmuted user" },
              { key: "warn_dm", type: "message", description: "DM sent to warned user" },
              { key: "error_no_permission", type: "message", description: "Sent when user lacks permission" },
              { key: "error_user_not_found", type: "message", description: "Sent when the target user cannot be found" },
              { key: "error_already_muted", type: "message", description: "Sent when trying to mute an already-muted user" },
              { key: "error_not_muted", type: "message", description: "Sent when trying to unmute a user who is not muted" },
              { key: "error_cannot_action_self", type: "message", description: "Sent when moderator tries to action themselves" },
              { key: "error_cannot_action_bot", type: "message", description: "Sent when trying to action the bot" },
              { key: "error_hierarchy", type: "message", description: "Sent when target has equal or higher role" },
            ],
          },
        ],
        commands: [
          { trigger: "ban", usage: "!ban @user [duration] [reason]", description: "Ban a member. Duration is optional — omit for permanent.", examples: ["!ban @User Spamming", "!ban @User 7d Repeated violations"] },
          { trigger: "forceban", usage: "!forceban <user_id> [duration] [reason]", description: "Ban a user by ID — works even if they are not in the server." },
          { trigger: "unban", usage: "!unban <user_id> [reason]", description: "Unban a user by ID." },
          { trigger: "tempban", usage: "!tempban @user <duration> [reason]", description: "Ban a member for a specific duration (required)." },
          { trigger: "baninfo", usage: "!baninfo <user_id>", description: "Show ban details for a user." },
          { trigger: "banlist", usage: "!banlist", description: "Show the server's ban list." },
          { trigger: "softban", usage: "!softban @user [reason]", description: "Ban then immediately unban to delete recent messages without a permanent ban." },
          { trigger: "kick", usage: "!kick @user [reason]", description: "Kick a member from the server." },
          { trigger: "mute", usage: "!mute @user [duration] [reason]", description: "Mute a member. Uses mute_role if set, otherwise Discord timeout." },
          { trigger: "forcemute", usage: "!forcemute <user_id> [duration] [reason]", description: "Mute a user by ID." },
          { trigger: "unmute", usage: "!unmute @user [reason]", description: "Unmute a member." },
          { trigger: "forceunmute", usage: "!forceunmute <user_id> [reason]", description: "Unmute a user by ID." },
          { trigger: "tempmute", usage: "!tempmute @user <duration> [reason]", description: "Mute for a specific duration (required)." },
          { trigger: "mutelist", usage: "!mutelist", description: "List all currently muted members." },
          { trigger: "muteinfo", usage: "!muteinfo @user", description: "Show mute details for a member." },
          { trigger: "warn", usage: "!warn @user [reason]", description: "Warn a member. Reason supports preset names." },
          { trigger: "forcewarn", usage: "!forcewarn <user_id> [reason]", description: "Warn a user by ID." },
          { trigger: "addcase", usage: "!addcase @user <type> [reason]", description: "Manually create a case without notifying the user. Types: ban, kick, mute, warn, note." },
          { trigger: "forceaddcase", usage: "!forceaddcase <user_id> <type> [reason]", description: "Manually create a case for a user by ID." },
          { trigger: "editcase", usage: "!editcase <case_id> reason <new_reason>", description: "Edit the reason of an existing case." },
          { trigger: "editcase", usage: "!editcase <case_id> duration <new_duration>", description: "Edit the duration of a timed case." },
          { trigger: "purge", usage: "!purge <amount>", description: "Delete the last N messages.", examples: ["!purge 50"] },
          { trigger: "purge", usage: "!purge @user <amount>", description: "Delete the last N messages from a specific user." },
          { trigger: "purge", usage: "!purge bots <amount>", description: "Delete messages from bots only." },
          { trigger: "purge", usage: "!purge embeds <amount>", description: "Delete messages with embeds." },
          { trigger: "purge", usage: "!purge images <amount>", description: "Delete messages with images/attachments." },
          { trigger: "purge", usage: "!purge links <amount>", description: "Delete messages containing links." },
          { trigger: "purge", usage: "!purge contains <text> <amount>", description: "Delete messages containing specific text." },
          { trigger: "purge", usage: "!purge before <message_id>", description: "Delete messages before a specific message ID." },
          { trigger: "purge", usage: "!purge after <message_id>", description: "Delete messages after a specific message ID." },
          { trigger: "purge", usage: "!purge between <msg_id> <msg_id>", description: "Delete messages between two message IDs." },
          { trigger: "purge", usage: "!purge pins", description: "Delete pinned messages." },
          { trigger: "purge", usage: "!purge reactions <message_id>", description: "Remove all reactions from a message." },
          { trigger: "slowmode", usage: "!slowmode <seconds> [#channel]", description: "Set slowmode in a channel (or current channel)." },
          { trigger: "slowmode", usage: "!slowmode off [#channel]", description: "Disable slowmode in a channel." },
          { trigger: "slowmodeinfo", usage: "!slowmodeinfo [#channel]", description: "Show current slowmode for a channel." },
          { trigger: "nick", usage: "!nick @user <nickname>", description: "Change a member's nickname." },
          { trigger: "resetnick", usage: "!resetnick @user", description: "Reset a member's nickname." },
          { trigger: "locknick", usage: "!locknick @user", description: "Lock a member's nickname so it cannot be changed." },
          { trigger: "unlocknick", usage: "!unlocknick @user", description: "Unlock a member's nickname." },
          { trigger: "watch", usage: "!watch @user [reason]", description: "Flag a user for increased scrutiny." },
          { trigger: "unwatch", usage: "!unwatch @user", description: "Remove watch flag from a user." },
          { trigger: "watchlist", usage: "!watchlist", description: "List all currently watched members." },
          { trigger: "roleban", usage: "!roleban @user <@role> [reason]", description: "Prevent a member from having a specific role." },
          { trigger: "unroleban", usage: "!unroleban @user <@role>", description: "Remove a roleban." },
          { trigger: "rolebanned", usage: "!rolebanned @user", description: "List rolebans for a member." },
          { trigger: "lock", usage: "!lock [#channel] [reason]", description: "Lock a channel so members cannot send messages." },
          { trigger: "unlock", usage: "!unlock [#channel] [reason]", description: "Unlock a channel." },
          { trigger: "hide", usage: "!hide [#channel] [reason]", description: "Hide a channel from members." },
          { trigger: "unhide", usage: "!unhide [#channel] [reason]", description: "Unhide a channel." },
          { trigger: "seen", usage: "!seen @user", description: "Show when a member was last seen." },
          { trigger: "cleanup", usage: "!cleanup <amount>", description: "Delete bot messages in the current channel." },
        ],
        content: `The **Moderation** plugin provides all core punishment commands.

## Preset reasons

Instead of typing a full reason, moderators can use preset names:

\`\`\`
!warn @User spam
\`\`\`

If \`spam\` is a configured preset reason, the full preset text is used automatically. See the **Preset Reasons** plugin.

## Mute modes

- **Mute Role** — set \`mute_role\` to a role ID. The role is applied on mute and removed on unmute.
- **Discord Timeout** — if \`mute_role\` is \`null\`, Discord's native timeout is used.

## Role stripping

When \`strip_roles_on_mute: true\`, all roles are removed from the member when muted and automatically restored when unmuted.

## Force commands

Commands prefixed with \`force\` accept a raw user ID instead of a mention — these work even if the user is not in the server.

## Background tasks

Timed mutes and timed bans are tracked in the database. A background task checks every 30 seconds and unmutes/unbans users whose time has expired.`,
      },

      // ── MASS ACTIONS ────────────────────────────────────────────────────────
      {
        id: "plugin-mass-actions",
        title: "Mass Actions",
        type: "plugin",
        configKey: "mass_actions",
        defaultConfig: `mass_actions:
  enabled: true
  messages:
    masswarn_success: "⚠️ Warned {success_count}/{count} users | Reason: {reason}"
    massmute_success: "🔇 Muted {success_count}/{count} users | Duration: {duration}"
    massunmute_success: "🔊 Unmuted {success_count}/{count} users"
    masskick_success: "👢 Kicked {success_count}/{count} users | Reason: {reason}"
    massban_success: "🔨 Banned {success_count}/{count} users | Reason: {reason}"
    massunban_success: "✅ Unbanned {success_count}/{count} users"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable mass action commands" },
          {
            key: "messages", type: "object", description: "Result messages after mass actions. Variable: {success_count} = succeeded, {count} = total attempted",
            children: [
              { key: "masswarn_success", type: "message", description: "Posted after masswarn completes" },
              { key: "massmute_success", type: "message", description: "Posted after massmute completes" },
              { key: "massunmute_success", type: "message", description: "Posted after massunmute completes" },
              { key: "masskick_success", type: "message", description: "Posted after masskick completes" },
              { key: "massban_success", type: "message", description: "Posted after massban completes" },
              { key: "massunban_success", type: "message", description: "Posted after massunban completes" },
            ],
          },
        ],
        commands: [
          { trigger: "masswarn", usage: "!masswarn @user1 @user2 ... | [reason]", description: "Warn multiple users at once. Use | to separate targets from reason.", examples: ["!masswarn @User1 @User2 @User3 | Raiding"] },
          { trigger: "massforcewarn", usage: "!massforcewarn <id1> <id2> ... | [reason]", description: "Warn multiple users by ID." },
          { trigger: "massmute", usage: "!massmute @user1 @user2 ... [duration] | [reason]", description: "Mute multiple users at once.", examples: ["!massmute @User1 @User2 1h | Raiding"] },
          { trigger: "massforcemute", usage: "!massforcemute <id1> <id2> ... [duration] | [reason]", description: "Mute multiple users by ID." },
          { trigger: "massunmute", usage: "!massunmute @user1 @user2 ... | [reason]", description: "Unmute multiple users at once." },
          { trigger: "masskick", usage: "!masskick @user1 @user2 ... | [reason]", description: "Kick multiple users at once.", examples: ["!masskick @User1 @User2 | Raiding"] },
          { trigger: "massforcekick", usage: "!massforcekick <id1> <id2> ... | [reason]", description: "Kick multiple users by ID." },
          { trigger: "massban", usage: "!massban @user1 @user2 ... [duration] | [reason]", description: "Ban multiple users at once.", examples: ["!massban @User1 @User2 | Raiding"] },
          { trigger: "massforceban", usage: "!massforceban <id1> <id2> ... [duration] | [reason]", description: "Ban multiple users by ID." },
          { trigger: "massunban", usage: "!massunban <id1> <id2> ... | [reason]", description: "Unban multiple users by ID." },
        ],
        content: `The **Mass Actions** plugin allows applying moderation actions to multiple users in a single command.

## Syntax

Use the **pipe \`|\`** character to separate target users from the reason:

\`\`\`
!massban @User1 @User2 @User3 7d | Coordinated raiding
\`\`\`

This bans all three users for 7 days with the reason "Coordinated raiding".

## Force variants

Every mass command has a \`force\` variant that accepts raw user IDs instead of mentions. This works for users who are not in the server:

\`\`\`
!massforceban 111111111 222222222 333333333 | Bot accounts
\`\`\``,
      },

      // ── CASES ───────────────────────────────────────────────────────────────
      {
        id: "plugin-cases",
        title: "Cases",
        type: "plugin",
        configKey: "cases",
        defaultConfig: `cases:
  enabled: true
  messages:
    case_not_found: "Case {trigger} not found"
    no_cases: "No cases found for {user}"
    no_server_cases: "No cases issued yet"
    case_deleted: "Case {trigger} deleted"
    case_edited: "Case {case_id} updated"
    casecount: "{user} | Warns: {trigger} | Mutes: {reason} | Kicks: {count} | Bans: {expires_at} | Notes: {new_reason} | Total: {success_count}"
    note_success: "Note added for {user} | Case: {case_id}"
    forcenote_success: "Note added for {user.id} | Case: {case_id}"
    note_deleted: "Note {case_id} deleted"
    note_not_found: "Note {case_id} not found"
    note_edited: "Note {case_id} updated"
    note_search_none: "No notes found matching {trigger}"
    error_no_permission: "You do not have permission to manage cases"
    case_embed:
      embed:
        title: "Case #{case_id}"
        color: "#7289DA"
        fields:
          - name: "Action"
            value: "{action}"
            inline: true
          - name: "User"
            value: "{user} ({user.id})"
            inline: true
          - name: "Moderator"
            value: "{mod} ({mod.id})"
            inline: true
          - name: "Reason"
            value: "{reason}"
            inline: false
          - name: "Date"
            value: "{timestamp}"
            inline: true`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the cases plugin" },
          {
            key: "messages", type: "object", description: "Customizable response messages",
            children: [
              { key: "case_not_found", type: "message", description: "When a case ID doesn't exist. Variable: {trigger} = case ID" },
              { key: "no_cases", type: "message", description: "When a user has no cases" },
              { key: "no_server_cases", type: "message", description: "When the server has no cases yet" },
              { key: "case_deleted", type: "message", description: "When a case is deleted" },
              { key: "case_edited", type: "message", description: "When a case is edited" },
              { key: "casecount", type: "message", description: "Summary of a user's case counts by type" },
              { key: "note_success", type: "message", description: "When a note is added" },
              { key: "forcenote_success", type: "message", description: "When a note is added by user ID" },
              { key: "note_deleted", type: "message", description: "When a note is deleted" },
              { key: "note_not_found", type: "message", description: "When a note ID doesn't exist" },
              { key: "note_edited", type: "message", description: "When a note is edited" },
              { key: "note_search_none", type: "message", description: "When no notes match the search keyword" },
              { key: "error_no_permission", type: "message", description: "When user lacks permission to manage cases" },
              { key: "case_embed", type: "message", description: "The embed used to display an individual case" },
            ],
          },
        ],
        commands: [
          { trigger: "case", usage: "!case <case_id>", description: "Show details for a specific case.", examples: ["!case 42"] },
          { trigger: "cases", usage: "!cases @user", description: "Show all cases for a user.", examples: ["!cases @User"] },
          { trigger: "servercases", usage: "!servercases", description: "Show the last 10 cases issued in the server." },
          { trigger: "deletecase", usage: "!deletecase <case_id>", description: "Delete a case by ID." },
          { trigger: "reason", usage: "!reason <case_id> <new_reason>", description: "Update the reason for a case." },
          { trigger: "editcase", usage: "!editcase <case_id> reason <new_reason>", description: "Edit the reason of a case." },
          { trigger: "editcase", usage: "!editcase <case_id> duration <new_duration>", description: "Edit the duration of a timed case." },
          { trigger: "casecount", usage: "!casecount @user", description: "Show a breakdown of case counts for a user by type." },
          { trigger: "exportcases", usage: "!exportcases @user", description: "Export all cases for a user." },
          { trigger: "note", usage: "!note @user <text>", description: "Add a staff note to a user's record (not shown to the user)." },
          { trigger: "forcenote", usage: "!forcenote <user_id> <text>", description: "Add a note to a user by ID." },
          { trigger: "viewnote", usage: "!viewnote <case_id>", description: "View a specific note." },
          { trigger: "viewnotes", usage: "!viewnotes @user", description: "View all notes for a user." },
          { trigger: "deletenote", usage: "!deletenote <case_id>", description: "Delete a note." },
          { trigger: "notesearch", usage: "!notesearch <keyword>", description: "Search notes by keyword." },
          { trigger: "editnote", usage: "!editnote <case_id> <new text>", description: "Edit the text of a note." },
        ],
        content: `The **Cases** plugin tracks all moderation actions as numbered case records.

## Case types

| Type | Created by |
|------|-----------|
| ban | !ban, !forceban, !tempban |
| kick | !kick |
| mute | !mute, !tempmute |
| warn | !warn, !forcewarn |
| note | !note, !addcase |

## Notes vs. Cases

- **Cases** are created automatically by moderation commands and may notify the user
- **Notes** are staff-only records added manually with \`!note\` — users are never notified`,
      },

      // ── AUTOMOD ─────────────────────────────────────────────────────────────
      {
        id: "plugin-automod",
        title: "Automod",
        type: "plugin",
        configKey: "automod",
        defaultConfig: `automod:
  enabled: true

  spam:
    enabled: true
    max_messages: 5
    interval_seconds: 5
    action: mute
    mute_duration_minutes: 10
    ignore_roles: []
    ignore_channels: []
    messages:
      channel_response:
        embed:
          title: "🛡️ Automod — Spam Detected"
          description: "{user.mention} was {action}d for spamming."
          color: "#FF6600"
          fields:
            - name: "Messages"
              value: "{trigger}"
              inline: true
            - name: "Action"
              value: "{action}"
              inline: true
          footer: "Automod • {timestamp}"
      user_dm:
        embed:
          title: "You were actioned for spamming"
          description: "You were {action}d in **{server}** for spamming."
          color: "#FF6600"
      log_response:
        embed:
          title: "🛡️ Automod Action — Spam"
          description: "{user.mention} was {action}d."
          color: "#FF6600"

  bad_words:
    enabled: true
    words: []
    action: delete
    ignore_roles: []
    ignore_channels: []
    messages:
      channel_response:
        embed:
          title: "🛡️ Automod — Prohibited Word"
          description: "{user.mention}'s message was removed."
          color: "#FF0000"
      user_dm: "Your message in **{server}** was removed for containing a prohibited word."
      log_response:
        embed:
          title: "🛡️ Automod — Bad Word"
          description: "{user.mention}'s message was deleted in {channel.mention}."
          color: "#FF0000"

  invite_links:
    enabled: false
    action: delete
    ignore_roles: []
    messages:
      channel_response: "❌ {user.mention} Discord invites are not allowed here."
      user_dm: "Your message in **{server}** was removed for containing a Discord invite link."
      log_response: "Automod: {user} posted an invite link in {channel}"

  mass_mentions:
    enabled: false
    max_mentions: 5
    action: mute
    mute_duration_minutes: 5
    messages:
      channel_response: "🛡️ {user.mention} was {action}d for mass mentioning."
      user_dm: "You were {action}d in **{server}** for mass mentioning ({trigger} mentions)."
      log_response: "Automod: {user} mass mentioned in {channel} | Count: {trigger}"

  caps_spam:
    enabled: false
    min_length: 10
    caps_percentage: 70
    action: delete
    messages:
      channel_response: "⚠️ {user.mention} please avoid excessive caps."
      user_dm: "Your message in **{server}** was removed for excessive caps."
      log_response: "Automod: {user} caps spam in {channel}"

  link_spam:
    enabled: false
    max_links: 3
    interval_seconds: 10
    action: mute
    ignore_roles: []
    messages:
      channel_response: "🔗 {user.mention} was {action}d for link spamming."
      user_dm: "You were {action}d in **{server}** for sending too many links."
      log_response: "Automod: {user} link spam in {channel}"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the automod plugin" },
          {
            key: "spam", type: "object", description: "Spam detection module",
            children: [
              { key: "enabled", type: "boolean", default: "true", description: "Enable spam detection" },
              { key: "max_messages", type: "number", default: "5", description: "Messages sent within the window to trigger" },
              { key: "interval_seconds", type: "number", default: "5", description: "Time window in seconds" },
              { key: "action", type: "delete | warn | mute | kick | ban", default: "mute", description: "Action to take when triggered" },
              { key: "mute_duration_minutes", type: "number", default: "10", description: "Mute duration when action is mute" },
              { key: "ignore_roles", type: "string[]", default: "[]", description: "Role IDs exempt from spam detection" },
              { key: "ignore_channels", type: "string[]", default: "[]", description: "Channel IDs exempt from spam detection" },
              { key: "messages.channel_response", type: "message", description: "Posted in the channel where spam was detected" },
              { key: "messages.user_dm", type: "message", description: "DM sent to the spammer" },
              { key: "messages.log_response", type: "message", description: "Posted in the logging channel" },
            ],
          },
          {
            key: "bad_words", type: "object", description: "Prohibited word filter",
            children: [
              { key: "enabled", type: "boolean", default: "true", description: "Enable the word filter" },
              { key: "words", type: "string[]", default: "[]", description: "List of words to block (case-insensitive)" },
              { key: "action", type: "delete | warn | mute | kick | ban", default: "delete", description: "Action when a bad word is detected" },
              { key: "ignore_roles", type: "string[]", default: "[]", description: "Role IDs exempt from this rule" },
              { key: "ignore_channels", type: "string[]", default: "[]", description: "Channel IDs exempt from this rule" },
              { key: "messages.channel_response", type: "message", description: "Posted in the channel where the word was detected" },
              { key: "messages.user_dm", type: "message", description: "DM sent to the user" },
              { key: "messages.log_response", type: "message", description: "Posted in the logging channel" },
            ],
          },
          {
            key: "invite_links", type: "object", description: "Discord invite link filter",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Block Discord invite links" },
              { key: "action", type: "delete | warn | mute | kick | ban", default: "delete", description: "Action when an invite link is detected" },
              { key: "ignore_roles", type: "string[]", default: "[]", description: "Role IDs that can post invites" },
              { key: "messages.channel_response", type: "message", description: "Posted in channel" },
              { key: "messages.user_dm", type: "message", description: "DM sent to user" },
              { key: "messages.log_response", type: "message", description: "Posted in logging channel" },
            ],
          },
          {
            key: "mass_mentions", type: "object", description: "Mass mention detection",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable mass mention detection" },
              { key: "max_mentions", type: "number", default: "5", description: "Number of mentions in a single message to trigger" },
              { key: "action", type: "delete | warn | mute | kick | ban", default: "mute", description: "Action when triggered" },
              { key: "mute_duration_minutes", type: "number", default: "5", description: "Mute duration when action is mute" },
              { key: "messages.channel_response", type: "message", description: "Posted in channel. Variable: {trigger} = mention count" },
              { key: "messages.user_dm", type: "message", description: "DM sent to user" },
              { key: "messages.log_response", type: "message", description: "Posted in logging channel" },
            ],
          },
          {
            key: "caps_spam", type: "object", description: "Excessive caps detection",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable caps detection" },
              { key: "min_length", type: "number", default: "10", description: "Minimum message length before caps % is checked" },
              { key: "caps_percentage", type: "number", default: "70", description: "Percentage of uppercase characters to trigger (0–100)" },
              { key: "action", type: "delete | warn | mute | kick | ban", default: "delete", description: "Action when triggered" },
              { key: "messages.channel_response", type: "message", description: "Posted in channel" },
              { key: "messages.user_dm", type: "message", description: "DM sent to user" },
              { key: "messages.log_response", type: "message", description: "Posted in logging channel" },
            ],
          },
          {
            key: "link_spam", type: "object", description: "Link spam detection",
            children: [
              { key: "enabled", type: "boolean", default: "false", description: "Enable link spam detection" },
              { key: "max_links", type: "number", default: "3", description: "Links sent within the window to trigger" },
              { key: "interval_seconds", type: "number", default: "10", description: "Time window in seconds" },
              { key: "action", type: "delete | warn | mute | kick | ban", default: "mute", description: "Action when triggered" },
              { key: "ignore_roles", type: "string[]", default: "[]", description: "Role IDs exempt from link spam detection" },
              { key: "messages.channel_response", type: "message", description: "Posted in channel" },
              { key: "messages.user_dm", type: "message", description: "DM sent to user" },
              { key: "messages.log_response", type: "message", description: "Posted in logging channel" },
            ],
          },
        ],
        content: `The **Automod** plugin automatically detects and acts on rule-breaking messages.

## Modules

| Module | What it detects |
|--------|----------------|
| \`spam\` | Too many messages sent too quickly |
| \`bad_words\` | Messages containing blocked words |
| \`invite_links\` | Discord server invite links |
| \`mass_mentions\` | Too many user/role mentions in one message |
| \`caps_spam\` | Messages with excessive uppercase |
| \`link_spam\` | Too many links sent too quickly |

## Per-rule messages

Every rule has three independently configurable messages:
- **\`channel_response\`** — posted in the channel where the violation happened
- **\`user_dm\`** — sent directly to the violating user
- **\`log_response\`** — posted in the logging channel

## Actions

| Action | Effect |
|--------|--------|
| \`delete\` | Delete the message only |
| \`warn\` | Delete + add a warning case |
| \`mute\` | Delete + mute the user |
| \`kick\` | Delete + kick the user |
| \`ban\` | Delete + ban the user |

## Template variables in automod messages

- \`{trigger}\` — what triggered the rule (word detected, spam count, mention count, etc.)
- \`{rule}\` — which automod rule fired`,
      },

      // ── LOGGING ─────────────────────────────────────────────────────────────
      {
        id: "plugin-logging",
        title: "Logging",
        type: "plugin",
        configKey: "logging",
        defaultConfig: `logging:
  enabled: true
  channel: null
  messages:
    message_delete: "Message deleted | User: {user} ({user.id}) | Channel: {channel} | Content: {trigger}"
    message_edit: "Message edited | User: {user} | Channel: {channel} | Before: {trigger} | After: {reason}"
    message_bulk_delete: "Bulk delete | Channel: {channel} | Count: {count}"
    member_join: "Member joined | {user} ({user.id}) | Account created: {user.created_at} | Members: {server.member_count}"
    member_leave: "Member left | {user} ({user.id})"
    member_ban: "Member banned | {user} ({user.id})"
    member_unban: "Member unbanned | {user} ({user.id})"
    role_added: "Role added | {user} | Role: {trigger}"
    role_removed: "Role removed | {user} | Role: {trigger}"
    nickname_change: "Nickname changed | {user} | Before: {trigger} | After: {reason}"
    voice_join: "Voice join | {user} | Channel: {channel}"
    voice_leave: "Voice leave | {user} | Channel: {channel}"
    voice_move: "Voice move | {user} | From: {trigger} | To: {reason}"
    channel_create: "Channel created | {channel}"
    channel_delete: "Channel deleted | {trigger}"
    channel_update: "Channel updated | {channel}"
    role_create: "Role created | {trigger}"
    role_delete: "Role deleted | {trigger}"
    role_update: "Role updated | {trigger}"
    server_update: "Server settings updated"
    invite_create: "Invite created | {user} | Channel: {channel}"
    invite_delete: "Invite deleted | Channel: {channel}"
    emoji_update: "Emojis updated"
    mod_action: "Mod action | {mod} {action}d {user} | Reason: {reason} | Duration: {duration} | Case: {case_id}"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the logging plugin" },
          { key: "channel", type: "snowflake | null", default: "null", description: "Default channel ID to post all log events to" },
          {
            key: "messages", type: "object", description: "Configurable message for each log event. All support embed format.",
            children: [
              { key: "message_delete", type: "message", description: "Message deleted. Variable: {trigger} = message content" },
              { key: "message_edit", type: "message", description: "Message edited. {trigger} = before, {reason} = after" },
              { key: "message_bulk_delete", type: "message", description: "Bulk message delete. Variable: {count}" },
              { key: "member_join", type: "message", description: "Member joined the server" },
              { key: "member_leave", type: "message", description: "Member left the server" },
              { key: "member_ban", type: "message", description: "Member was banned" },
              { key: "member_unban", type: "message", description: "Member was unbanned" },
              { key: "role_added", type: "message", description: "Role added to a member. Variable: {trigger} = role name" },
              { key: "role_removed", type: "message", description: "Role removed from a member. Variable: {trigger} = role name" },
              { key: "nickname_change", type: "message", description: "Nickname changed. {trigger} = old nick, {reason} = new nick" },
              { key: "voice_join", type: "message", description: "Member joined a voice channel" },
              { key: "voice_leave", type: "message", description: "Member left a voice channel" },
              { key: "voice_move", type: "message", description: "Member moved voice channels. {trigger} = from, {reason} = to" },
              { key: "channel_create", type: "message", description: "A channel was created" },
              { key: "channel_delete", type: "message", description: "A channel was deleted. Variable: {trigger} = channel name" },
              { key: "channel_update", type: "message", description: "A channel was updated" },
              { key: "role_create", type: "message", description: "A role was created. Variable: {trigger} = role name" },
              { key: "role_delete", type: "message", description: "A role was deleted. Variable: {trigger} = role name" },
              { key: "role_update", type: "message", description: "A role was updated. Variable: {trigger} = role name" },
              { key: "server_update", type: "message", description: "Server settings were changed" },
              { key: "invite_create", type: "message", description: "An invite was created" },
              { key: "invite_delete", type: "message", description: "An invite was deleted" },
              { key: "emoji_update", type: "message", description: "Server emojis were updated" },
              { key: "mod_action", type: "message", description: "A moderation action was taken. All action variables available." },
            ],
          },
        ],
        content: `The **Logging** plugin logs every significant Discord event to a channel.

## Events tracked

| Event | Variable notes |
|-------|---------------|
| \`message_delete\` | \`{trigger}\` = deleted content |
| \`message_edit\` | \`{trigger}\` = before, \`{reason}\` = after |
| \`message_bulk_delete\` | \`{count}\` = number deleted |
| \`member_join\` | \`{user.created_at}\` for account age |
| \`member_leave\` | |
| \`member_ban\` / \`member_unban\` | |
| \`role_added\` / \`role_removed\` | \`{trigger}\` = role name |
| \`nickname_change\` | \`{trigger}\` = before, \`{reason}\` = after |
| \`voice_join\` / \`voice_leave\` / \`voice_move\` | \`{trigger}\` / \`{reason}\` = channel names |
| \`channel_create\` / \`channel_delete\` / \`channel_update\` | |
| \`role_create\` / \`role_delete\` / \`role_update\` | |
| \`server_update\` | |
| \`invite_create\` / \`invite_delete\` | |
| \`emoji_update\` | |
| \`mod_action\` | full moderation action details |

## Customizing log format

Each event message supports plain text, embeds, or content+embed format. Use embed format for rich log entries:

\`\`\`yaml
logging:
  channel: "999888777666555444"
  messages:
    member_join:
      embed:
        title: "✅ Member Joined"
        description: "{user.mention} joined the server."
        color: "#00FF00"
        fields:
          - name: "Account Created"
            value: "{user.created_at}"
            inline: true
          - name: "Member Count"
            value: "{server.member_count}"
            inline: true
        thumbnail: "{user.avatar}"
        footer: "{timestamp}"
\`\`\``,
      },

      // ── ANTI-NUKE ────────────────────────────────────────────────────────────
      {
        id: "plugin-antinuke",
        title: "Anti-Nuke",
        type: "plugin",
        configKey: "antinuke",
        defaultConfig: `antinuke:
  enabled: false
  whitelist_roles: []
  whitelist_users: []
  thresholds:
    channel_delete: 3
    channel_create: 5
    role_delete: 3
    role_create: 5
    ban: 5
    kick: 5
    webhook_create: 3
    role_everyone_update: 1
  interval_seconds: 10
  action: ban
  quarantine_role: null
  messages:
    triggered: "{user} exceeded the {rule} threshold and was {action}d | Count: {count} | Case: {case_id}"`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable Anti-Nuke protection" },
          { key: "whitelist_roles", type: "string[]", default: "[]", description: "Role IDs exempt from Anti-Nuke (e.g. your admin role)" },
          { key: "whitelist_users", type: "string[]", default: "[]", description: "User IDs exempt from Anti-Nuke" },
          { key: "interval_seconds", type: "number", default: "10", description: "Detection window in seconds" },
          { key: "action", type: "ban | kick | quarantine", default: "ban", description: "Action taken against the attacker. 'quarantine' applies the quarantine_role." },
          { key: "quarantine_role", type: "snowflake | null", default: "null", description: "Role ID to assign when action is 'quarantine'" },
          {
            key: "thresholds", type: "object", description: "Per-action thresholds within the detection window",
            children: [
              { key: "channel_delete", type: "number", default: "3", description: "Channel deletions before triggering" },
              { key: "channel_create", type: "number", default: "5", description: "Channel creations before triggering" },
              { key: "role_delete", type: "number", default: "3", description: "Role deletions before triggering" },
              { key: "role_create", type: "number", default: "5", description: "Role creations before triggering" },
              { key: "ban", type: "number", default: "5", description: "Bans before triggering" },
              { key: "kick", type: "number", default: "5", description: "Kicks before triggering" },
              { key: "webhook_create", type: "number", default: "3", description: "Webhook creations before triggering" },
              { key: "role_everyone_update", type: "number", default: "1", description: "Updates to @everyone permissions before triggering" },
            ],
          },
          {
            key: "messages", type: "object", description: "Customizable log messages",
            children: [
              { key: "triggered", type: "message", description: "Posted when Anti-Nuke triggers. Variables: {user} {rule} {action} {count} {case_id}" },
            ],
          },
        ],
        content: `The **Anti-Nuke** plugin detects and stops mass destructive actions by compromised or rogue admin accounts.

## How it works

Every destructive action (channel delete, role delete, ban, etc.) is counted per-user within a sliding time window. When a user exceeds a threshold, they are immediately actioned.

## Thresholds

Configure how many of each action type within \`interval_seconds\` triggers Anti-Nuke:

\`\`\`yaml
antinuke:
  enabled: true
  interval_seconds: 10
  action: ban
  thresholds:
    channel_delete: 3
    role_delete: 3
    ban: 5
    kick: 5
    webhook_create: 3
    role_everyone_update: 1
\`\`\`

## Whitelist

Always whitelist your most trusted admins:

\`\`\`yaml
antinuke:
  whitelist_users:
    - "YOUR_USER_ID_HERE"
  whitelist_roles:
    - "YOUR_ADMIN_ROLE_ID"
\`\`\``,
      },

      // ── ANTI-RAID ────────────────────────────────────────────────────────────
      {
        id: "plugin-antiraid",
        title: "Anti-Raid",
        type: "plugin",
        configKey: "antiraid",
        defaultConfig: `antiraid:
  enabled: false
  join_threshold: 10
  join_interval_seconds: 10
  account_age_min_days: 7
  action: kick
  lockdown_channels: []
  auto_unlock_minutes: 10
  messages:
    raid_detected: "Raid detected | {count} joins in {duration} | Action: {action} | Affected: {success_count}"
    raid_ended: "Raid mode ended"
    new_account_flagged: "New account | {user} ({user.id}) | Age: {trigger} days"`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable Anti-Raid protection" },
          { key: "join_threshold", type: "number", default: "10", description: "Number of joins within the window to trigger raid mode" },
          { key: "join_interval_seconds", type: "number", default: "10", description: "Time window in seconds for counting joins" },
          { key: "account_age_min_days", type: "number", default: "7", description: "Accounts younger than this (in days) are flagged as suspicious" },
          { key: "action", type: "kick | ban | mute", default: "kick", description: "Action taken against raid members" },
          { key: "lockdown_channels", type: "string[]", default: "[]", description: "Channel IDs to lock when raid mode activates" },
          { key: "auto_unlock_minutes", type: "number", default: "10", description: "Minutes after which locked channels are automatically unlocked" },
          {
            key: "messages", type: "object", description: "Customizable messages",
            children: [
              { key: "raid_detected", type: "message", description: "Posted when a raid is detected. Variables: {count} {duration} {action} {success_count}" },
              { key: "raid_ended", type: "message", description: "Posted when raid mode ends" },
              { key: "new_account_flagged", type: "message", description: "Posted when a new account joins. Variable: {trigger} = account age in days" },
            ],
          },
        ],
        commands: [
          { trigger: "raidmode", usage: "!raidmode on", description: "Manually activate raid mode." },
          { trigger: "raidmode", usage: "!raidmode off", description: "Manually deactivate raid mode." },
        ],
        content: `The **Anti-Raid** plugin detects coordinated mass join attacks and automatically takes action.

## How it works

When more than \`join_threshold\` users join within \`join_interval_seconds\`, raid mode activates. All members who joined during the raid window are actioned with the configured \`action\`.

Configured \`lockdown_channels\` are automatically locked and unlocked after \`auto_unlock_minutes\`.

## New account detection

Accounts younger than \`account_age_min_days\` are flagged when they join, even outside of an active raid.

## Manual control

Moderators can toggle raid mode manually with \`!raidmode on\` and \`!raidmode off\`.`,
      },

      // ── LOCKDOWN ─────────────────────────────────────────────────────────────
      {
        id: "plugin-lockdown",
        title: "Lockdown",
        type: "plugin",
        configKey: "lockdown",
        defaultConfig: `lockdown:
  enabled: true
  server_lockdown_channels: []
  presets:
    raid:
      channels: []
      reason: "Raid detected"
      remove_send: true
      remove_reactions: false
      remove_threads: true
    exam:
      channels: []
      reason: "Exam period"
      remove_send: true
      remove_reactions: false
      remove_threads: false
  messages:
    lockdown_start: "{channel} has been locked | Reason: {reason}"
    lockdown_end: "{channel} has been unlocked"
    lockdown_server_start: "Server lockdown activated | {count} channels locked"
    lockdown_server_end: "Server lockdown lifted"
    lockdown_channel_notice: "This channel has been locked | Reason: {reason}"
    unlock_channel_notice: "This channel has been unlocked"
    already_locked: "{channel} is already locked"
    not_locked: "{channel} is not locked"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the lockdown plugin" },
          { key: "server_lockdown_channels", type: "string[]", default: "[]", description: "Channel IDs included in a server-wide lockdown" },
          {
            key: "presets", type: "object", description: "Named lockdown presets",
            children: [
              { key: "<preset_name>.channels", type: "string[]", description: "Channel IDs locked by this preset" },
              { key: "<preset_name>.reason", type: "string", description: "Default reason shown in the lock notice" },
              { key: "<preset_name>.remove_send", type: "boolean", default: "true", description: "Deny Send Messages permission when locked" },
              { key: "<preset_name>.remove_reactions", type: "boolean", default: "false", description: "Deny Add Reactions permission when locked" },
              { key: "<preset_name>.remove_threads", type: "boolean", default: "true", description: "Deny Create Threads permission when locked" },
            ],
          },
          {
            key: "messages", type: "object", description: "Customizable messages",
            children: [
              { key: "lockdown_start", type: "message", description: "Posted when a channel is locked" },
              { key: "lockdown_end", type: "message", description: "Posted when a channel is unlocked" },
              { key: "lockdown_server_start", type: "message", description: "Posted when server lockdown activates. Variable: {count} = channels locked" },
              { key: "lockdown_server_end", type: "message", description: "Posted when server lockdown is lifted" },
              { key: "lockdown_channel_notice", type: "message", description: "Posted inside the locked channel" },
              { key: "unlock_channel_notice", type: "message", description: "Posted inside the channel when unlocked" },
              { key: "already_locked", type: "message", description: "When trying to lock an already locked channel" },
              { key: "not_locked", type: "message", description: "When trying to unlock a channel that isn't locked" },
            ],
          },
        ],
        commands: [
          { trigger: "lockdown", usage: "!lockdown [#channel] [reason]", description: "Lock a channel (or current channel) so members cannot send messages." },
          { trigger: "lockdown", usage: "!lockdown <preset> [reason]", description: "Activate a named lockdown preset, locking its configured channels.", examples: ["!lockdown raid", "!lockdown exam Server test underway"] },
          { trigger: "lockdown", usage: "!lockdown <preset> -server [reason]", description: "Activate a preset and also lock all server_lockdown_channels." },
          { trigger: "lockdown", usage: "!lockdown list", description: "Show all configured lockdown presets." },
          { trigger: "unlock", usage: "!unlock [#channel] [reason]", description: "Unlock a channel." },
          { trigger: "unlock", usage: "!unlock -server [reason]", description: "Unlock all channels locked by the current server lockdown." },
        ],
        content: `The **Lockdown** plugin allows quickly locking channels or the entire server.

## Presets

Presets are named lockdown configurations. Define them in YAML:

\`\`\`yaml
lockdown:
  presets:
    raid:
      channels:
        - "CHANNEL_ID_1"
        - "CHANNEL_ID_2"
      reason: "Raid in progress"
      remove_send: true
      remove_threads: true
    maintenance:
      channels:
        - "CHANNEL_ID_3"
      reason: "Maintenance"
      remove_send: true
\`\`\`

Then run \`!lockdown raid\` to instantly lock those channels.`,
      },

      // ── TAGS ────────────────────────────────────────────────────────────────
      {
        id: "plugin-tags",
        title: "Tags",
        type: "plugin",
        configKey: "tags",
        defaultConfig: `tags:
  enabled: true
  messages:
    tag_not_found: "❌ Tag \`{trigger}\` not found."
    tag_added: "✅ Tag \`{trigger}\` added successfully."
    tag_deleted: "✅ Tag \`{trigger}\` deleted."
    tag_already_exists: "❌ Tag \`{trigger}\` already exists."
    tag_list_empty: "No tags have been created yet."
    error_no_permission: "❌ You don't have permission to manage tags."`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the tags plugin" },
          {
            key: "messages", type: "object", description: "Customizable messages",
            children: [
              { key: "tag_not_found", type: "message", description: "When a tag name doesn't exist. Variable: {trigger} = tag name" },
              { key: "tag_added", type: "message", description: "When a tag is created" },
              { key: "tag_deleted", type: "message", description: "When a tag is deleted" },
              { key: "tag_already_exists", type: "message", description: "When trying to create a tag that already exists" },
              { key: "tag_list_empty", type: "message", description: "When no tags have been created yet" },
              { key: "error_no_permission", type: "message", description: "When user lacks permission to manage tags" },
            ],
          },
        ],
        commands: [
          { trigger: "tag", usage: "!tag <name>", description: "Post the content of a tag.", examples: ["!tag rules", "!tag info"] },
          { trigger: "tag add", usage: "!tag add <name> <content>", description: "Create a new tag.", examples: ["!tag add rules Read the rules in #rules!"] },
          { trigger: "tag delete", usage: "!tag delete <name>", description: "Delete a tag." },
          { trigger: "tag list", usage: "!tag list", description: "List all tags in the server." },
        ],
        content: `The **Tags** plugin provides custom text commands per server — useful for FAQs, rules summaries, links, and common responses.`,
      },

      // ── REMINDERS ────────────────────────────────────────────────────────────
      {
        id: "plugin-reminders",
        title: "Reminders",
        type: "plugin",
        configKey: "reminders",
        defaultConfig: `reminders:
  enabled: true
  messages:
    reminder_set: "Reminder set for {duration} | Fires at: {expires_at}"
    reminder_fired: "{user.mention} Reminder: {reminder_message}"
    reminder_not_found: "Reminder not found"
    reminder_deleted: "Reminder deleted"
    reminder_list_empty: "You have no active reminders"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the reminders plugin" },
          {
            key: "messages", type: "object", description: "Customizable messages",
            children: [
              { key: "reminder_set", type: "message", description: "Confirmation when a reminder is set. Variables: {duration} {expires_at}" },
              { key: "reminder_fired", type: "message", description: "Sent when the reminder fires. Variable: {reminder_message} = the reminder text" },
              { key: "reminder_not_found", type: "message", description: "When a reminder ID doesn't exist" },
              { key: "reminder_deleted", type: "message", description: "When a reminder is deleted" },
              { key: "reminder_list_empty", type: "message", description: "When the user has no active reminders" },
            ],
          },
        ],
        content: `The **Reminders** plugin lets users set personal timed reminders.`,
      },

      // ── TIMEZONES ────────────────────────────────────────────────────────────
      {
        id: "plugin-timezones",
        title: "Timezones",
        type: "plugin",
        configKey: "timezones",
        defaultConfig: `timezones:
  enabled: true
  messages:
    timezone_set: "Your timezone has been set to {trigger}"
    timezone_get: "{user} timezone is {trigger}"
    timezone_cleared: "Your timezone has been cleared"
    timezone_not_set: "{user} has not set a timezone"
    timezone_invalid: "Invalid timezone. Use a valid tz identifier e.g. America/New_York"
    time_result: "Current time for {user}: {trigger}"
    timefor_result: "Current time in {trigger}: {reason}"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the timezones plugin" },
          {
            key: "messages", type: "object", description: "Customizable messages",
            children: [
              { key: "timezone_set", type: "message", description: "When a user sets their timezone. Variable: {trigger} = timezone name" },
              { key: "timezone_get", type: "message", description: "When viewing a user's timezone" },
              { key: "timezone_cleared", type: "message", description: "When a user clears their timezone" },
              { key: "timezone_not_set", type: "message", description: "When a user has no timezone set" },
              { key: "timezone_invalid", type: "message", description: "When an invalid timezone identifier is provided" },
              { key: "time_result", type: "message", description: "Current time display. Variable: {trigger} = formatted time" },
              { key: "timefor_result", type: "message", description: "Time for a specific timezone. {trigger} = timezone, {reason} = formatted time" },
            ],
          },
        ],
        commands: [
          { trigger: "timezone set", usage: "!timezone set <timezone>", description: "Set your timezone. Use IANA format e.g. America/New_York.", examples: ["!timezone set America/New_York", "!timezone set Europe/London"] },
          { trigger: "timezone get", usage: "!timezone get [@user]", description: "Show your timezone or another user's timezone." },
          { trigger: "timezone list", usage: "!timezone list", description: "List all members with timezones set." },
          { trigger: "timezone clear", usage: "!timezone clear", description: "Clear your saved timezone." },
          { trigger: "time", usage: "!time [@user]", description: "Show the current time for a user based on their saved timezone." },
          { trigger: "timefor", usage: "!timefor <timezone>", description: "Show the current time in any timezone.", examples: ["!timefor America/Los_Angeles", "!timefor Europe/Berlin"] },
          { trigger: "timeconvert", usage: "!timeconvert <time> <from_tz> <to_tz>", description: "Convert a specific time between two timezones.", examples: ["!timeconvert 3:00pm America/New_York Europe/London"] },
        ],
        content: `The **Timezones** plugin stores per-user timezone preferences and provides time conversion commands.`,
      },

      // ── HISTORY ─────────────────────────────────────────────────────────────
      {
        id: "plugin-history",
        title: "History",
        type: "plugin",
        configKey: "history",
        defaultConfig: `history:
  enabled: true
  messages:
    history_empty: "No history found for {user}"
    history_cleared: "History cleared for {user}"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the history plugin" },
          {
            key: "messages", type: "object", description: "Customizable messages",
            children: [
              { key: "history_empty", type: "message", description: "When a user has no history" },
              { key: "history_cleared", type: "message", description: "When a user's history is cleared" },
            ],
          },
        ],
        commands: [
          { trigger: "history", usage: "!history @user", description: "Show full history for a member (cases, notes, joins, role changes)." },
          { trigger: "history", usage: "!history @user cases", description: "Show only case history." },
          { trigger: "history", usage: "!history @user notes", description: "Show only notes." },
          { trigger: "history", usage: "!history @user joins", description: "Show join/leave history." },
          { trigger: "history", usage: "!history @user roles", description: "Show role change history." },
          { trigger: "history clear", usage: "!history clear @user", description: "Clear all history for a member." },
        ],
        content: `The **History** plugin provides a complete timeline view of a member's activity including all cases, notes, joins/leaves, and role changes.`,
      },

      // ── ROLES ────────────────────────────────────────────────────────────────
      {
        id: "plugin-roles",
        title: "Roles",
        type: "plugin",
        configKey: "roles",
        defaultConfig: `roles:
  enabled: true
  dm_on_action: true
  messages:
    addrole_success: "{user} has been given {trigger} | Reason: {reason}"
    removerole_success: "{trigger} has been removed from {user} | Reason: {reason}"
    temprole_success: "{user} has been given {trigger} | Duration: {duration} | Expires: {expires_at}"
    temprole_dm: "You have been given {trigger} in {server} | Duration: {duration}"
    temprole_expired: "{user} temp role {trigger} has expired"
    temprole_expired_dm: "Your temporary role {trigger} in {server} has expired"
    temprole_list_empty: "No active temp roles"
    error_role_not_found: "Role not found"
    error_already_has_role: "{user} already has {trigger}"
    error_missing_role: "{user} does not have {trigger}"
    error_role_hierarchy: "That role is above my highest role"
    error_managed_role: "That role is managed by an integration"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the roles plugin" },
          { key: "dm_on_action", type: "boolean", default: "true", description: "DM the user when a temp role is given or expires" },
          {
            key: "messages", type: "object", description: "Customizable messages. Variable: {trigger} = role name",
            children: [
              { key: "addrole_success", type: "message", description: "When a role is added" },
              { key: "removerole_success", type: "message", description: "When a role is removed" },
              { key: "temprole_success", type: "message", description: "When a temp role is given" },
              { key: "temprole_dm", type: "message", description: "DM sent when a temp role is given" },
              { key: "temprole_expired", type: "message", description: "Posted when a temp role expires" },
              { key: "temprole_expired_dm", type: "message", description: "DM sent when a temp role expires" },
              { key: "temprole_list_empty", type: "message", description: "When there are no active temp roles" },
              { key: "error_role_not_found", type: "message", description: "When the role cannot be found" },
              { key: "error_already_has_role", type: "message", description: "When the user already has the role" },
              { key: "error_missing_role", type: "message", description: "When trying to remove a role the user doesn't have" },
              { key: "error_role_hierarchy", type: "message", description: "When the role is above the bot's highest role" },
              { key: "error_managed_role", type: "message", description: "When the role is managed by an integration" },
            ],
          },
        ],
        content: `The **Roles** plugin provides role management commands including temporary roles.`,
      },

      // ── WELCOME ──────────────────────────────────────────────────────────────
      {
        id: "plugin-welcome",
        title: "Welcome",
        type: "plugin",
        configKey: "welcome",
        defaultConfig: `welcome:
  enabled: false
  welcome:
    enabled: false
    channel: null
    ping: false
    delete_after: null
    message: "Welcome to {server}, {user.mention}! You are our {ordinal} member."
  goodbye:
    enabled: false
    channel: null
    delete_after: null
    message: "{user} has left {server}. We now have {server.member_count} members."
  join_dm:
    enabled: false
    message: "Welcome to {server}! Please read the rules."
  welcome_role:
    enabled: false
    role: null
  rejoin_restore_roles:
    enabled: false
    ignore_roles: []
  account_age_gate:
    enabled: false
    min_age_days: 7
    kick: true
    message: "Your account is too new to join {server}. Please wait {trigger} more days."
  member_count_channel:
    enabled: false
    channel: null
    format: "Members: {server.member_count}"
    update_on: both`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the welcome plugin" },
          { key: "welcome.enabled", type: "boolean", default: "false", description: "Enable welcome messages" },
          { key: "welcome.channel", type: "snowflake | null", default: "null", description: "Channel to post welcome messages in" },
          { key: "welcome.ping", type: "boolean", default: "false", description: "Whether to ping the user in the welcome message" },
          { key: "welcome.delete_after", type: "number | null", default: "null", description: "Seconds after which the welcome message is deleted (null = never)" },
          { key: "welcome.message", type: "message", default: "...", description: "Welcome message. Variables: {user.mention} {server} {ordinal}" },
          { key: "goodbye.enabled", type: "boolean", default: "false", description: "Enable goodbye messages" },
          { key: "goodbye.channel", type: "snowflake | null", default: "null", description: "Channel for goodbye messages" },
          { key: "goodbye.delete_after", type: "number | null", default: "null", description: "Seconds before goodbye message is deleted" },
          { key: "goodbye.message", type: "message", default: "...", description: "Goodbye message. Variables: {user} {server} {server.member_count}" },
          { key: "join_dm.enabled", type: "boolean", default: "false", description: "DM new members on join" },
          { key: "join_dm.message", type: "message", default: "...", description: "DM message sent on join" },
          { key: "welcome_role.enabled", type: "boolean", default: "false", description: "Assign a role to new members on join" },
          { key: "welcome_role.role", type: "snowflake | null", default: "null", description: "Role ID to assign to new members" },
          { key: "rejoin_restore_roles.enabled", type: "boolean", default: "false", description: "Restore roles when a member rejoins" },
          { key: "rejoin_restore_roles.ignore_roles", type: "string[]", default: "[]", description: "Role IDs to not restore on rejoin" },
          { key: "account_age_gate.enabled", type: "boolean", default: "false", description: "Kick accounts that are too new" },
          { key: "account_age_gate.min_age_days", type: "number", default: "7", description: "Minimum account age in days required to join" },
          { key: "account_age_gate.kick", type: "boolean", default: "true", description: "Kick the account if it is too new (false = just DM)" },
          { key: "account_age_gate.message", type: "message", default: "...", description: "Message sent before kicking. Variable: {trigger} = days remaining" },
          { key: "member_count_channel.enabled", type: "boolean", default: "false", description: "Update a voice channel name with the member count" },
          { key: "member_count_channel.channel", type: "snowflake | null", default: "null", description: "Voice channel ID to update" },
          { key: "member_count_channel.format", type: "string", default: "Members: {server.member_count}", description: "Channel name format. Variable: {server.member_count}" },
          { key: "member_count_channel.update_on", type: "join | leave | both", default: "both", description: "When to update the counter" },
        ],
        content: `The **Welcome** plugin handles member join/leave events including welcome messages, goodbye messages, join DMs, auto roles, role restore on rejoin, account age gating, and a live member count channel.`,
      },

      // ── STARBOARD ────────────────────────────────────────────────────────────
      {
        id: "plugin-starboard",
        title: "Starboard",
        type: "plugin",
        configKey: "starboard",
        defaultConfig: `starboard:
  enabled: false
  channel: null
  emoji: "⭐"
  threshold: 3
  self_star: false
  remove_on_unstar: false
  ignore_channels: []
  ignore_roles: []
  ignored_users: []
  nsfw_allowed: false
  max_age_days: 7
  bots_allowed: false
  messages:
    starboard_empty: "No starred messages found"
    stats_none: "No star data found for {user}"
    starboard_cleared: "Starboard entries cleared for {user}"`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the starboard" },
          { key: "channel", type: "snowflake | null", default: "null", description: "Channel ID where starred messages are posted" },
          { key: "emoji", type: "string", default: "⭐", description: "Reaction emoji that counts as a star" },
          { key: "threshold", type: "number", default: "3", description: "Number of star reactions required to post to the starboard" },
          { key: "self_star", type: "boolean", default: "false", description: "Whether users can star their own messages" },
          { key: "remove_on_unstar", type: "boolean", default: "false", description: "Remove a starboard entry if stars drop below threshold" },
          { key: "ignore_channels", type: "string[]", default: "[]", description: "Channel IDs excluded from the starboard" },
          { key: "ignore_roles", type: "string[]", default: "[]", description: "Role IDs whose reactions do not count" },
          { key: "ignored_users", type: "string[]", default: "[]", description: "User IDs whose messages cannot be starred" },
          { key: "nsfw_allowed", type: "boolean", default: "false", description: "Allow messages from NSFW channels" },
          { key: "max_age_days", type: "number", default: "7", description: "Maximum age of a message (in days) that can be starred" },
          { key: "bots_allowed", type: "boolean", default: "false", description: "Allow bot messages to be starred" },
        ],
        content: `The **Starboard** plugin reposts highly-reacted messages to a dedicated channel.`,
      },

      // ── AUTOREPLY ────────────────────────────────────────────────────────────
      {
        id: "plugin-autoreply",
        title: "Autoreply",
        type: "plugin",
        configKey: "autoreply",
        defaultConfig: `autoreply:
  enabled: true
  replies: []
  messages:
    autoreply_added: "Auto reply {trigger} added"
    autoreply_removed: "Auto reply {trigger} removed"
    autoreply_enabled: "Auto reply {trigger} enabled"
    autoreply_disabled: "Auto reply {trigger} disabled"
    autoreply_edited: "Auto reply {trigger} updated"
    autoreply_not_found: "Auto reply {trigger} not found"
    autoreply_list_empty: "No auto replies configured"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable autoreply" },
          {
            key: "replies", type: "array", default: "[]", description: "List of autoreply rules",
            children: [
              { key: "trigger", type: "string", description: "Text pattern that triggers this reply (substring match)" },
              { key: "response", type: "string", description: "Response message to send" },
              { key: "channels", type: "string[]", description: "Limit to specific channel IDs (empty = all channels)" },
              { key: "enabled", type: "boolean", default: "true", description: "Whether this rule is active" },
            ],
          },
        ],
        content: `The **Autoreply** plugin automatically responds to messages containing configured trigger text.`,
      },

      // ── AUTOREACTION ─────────────────────────────────────────────────────────
      {
        id: "plugin-autoreaction",
        title: "Autoreaction",
        type: "plugin",
        configKey: "autoreaction",
        defaultConfig: `autoreaction:
  enabled: true
  reactions: []
  messages:
    autoreaction_added: "Auto reaction {trigger} added"
    autoreaction_removed: "Auto reaction {trigger} removed"
    autoreaction_not_found: "Auto reaction {trigger} not found"
    autoreaction_list_empty: "No auto reactions configured"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable autoreaction" },
          {
            key: "reactions", type: "array", default: "[]", description: "List of autoreaction rules",
            children: [
              { key: "trigger", type: "string", description: "Text pattern that triggers the reaction (or * for all messages)" },
              { key: "emojis", type: "string[]", description: "List of emojis to react with" },
              { key: "channels", type: "string[]", description: "Limit to specific channel IDs (empty = all channels)" },
              { key: "enabled", type: "boolean", default: "true", description: "Whether this rule is active" },
            ],
          },
        ],
        content: `The **Autoreaction** plugin automatically adds emoji reactions to messages matching configured triggers.`,
      },

      // ── AUTOCLEAN ────────────────────────────────────────────────────────────
      {
        id: "plugin-autoclean",
        title: "Autoclean",
        type: "plugin",
        configKey: "autoclean",
        defaultConfig: `autoclean:
  enabled: false
  channels: []
  messages:
    autoclean_added: "Autoclean added for {channel} | Mode: {trigger}"
    autoclean_removed: "Autoclean removed from {channel}"
    autoclean_ran: "Autoclean ran in {channel} | Deleted: {count} messages"
    autoclean_list_empty: "No autoclean rules configured"`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable autoclean" },
          {
            key: "channels", type: "array", default: "[]", description: "List of autoclean channel rules",
            children: [
              { key: "channel", type: "snowflake", description: "Channel ID to clean" },
              { key: "mode", type: "string", description: "What to delete: all, bots, humans, embeds, attachments" },
              { key: "interval_minutes", type: "number", description: "How often to run the clean (in minutes)" },
              { key: "enabled", type: "boolean", default: "true", description: "Whether this rule is active" },
            ],
          },
        ],
        content: `The **Autoclean** plugin automatically deletes messages in specified channels on a schedule.`,
      },

      // ── TICKETS ──────────────────────────────────────────────────────────────
      {
        id: "plugin-tickets",
        title: "Tickets",
        type: "plugin",
        configKey: "tickets",
        defaultConfig: `tickets:
  enabled: false
  log_channel: null
  transcript_channel: null
  dm_transcript: true
  max_open_per_user: 1
  messages:
    ticket_opened: "Your ticket has been opened in {channel}"
    ticket_already_open: "You already have an open ticket at {channel}"
    ticket_blacklisted: "You are blacklisted from opening tickets | Reason: {reason}"
    ticket_closed: "Ticket closed by {mod} | Reason: {reason}"
    ticket_claimed: "Ticket claimed by {mod}"
    ticket_unclaimed: "Ticket unclaimed by {mod}"
    ticket_deleted: "Ticket deleted by {mod}"
    adduser_success: "{trigger} has been added to the ticket"
    removeuser_success: "{trigger} has been removed from the ticket"
    ticket_renamed: "Ticket renamed to {trigger}"
    blacklist_success: "{user} has been blacklisted from tickets | Reason: {reason}"
    unblacklist_success: "{user} has been removed from the ticket blacklist"
    blacklist_list_empty: "No users blacklisted from tickets"
    not_a_ticket: "This command can only be used inside a ticket channel"
    transcript_sent: "Transcript sent"`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable the ticket system" },
          { key: "log_channel", type: "snowflake | null", default: "null", description: "Channel to log ticket events (open, close, delete)" },
          { key: "transcript_channel", type: "snowflake | null", default: "null", description: "Channel where transcripts are posted on ticket close/delete" },
          { key: "dm_transcript", type: "boolean", default: "true", description: "DM the ticket creator the transcript when the ticket is closed" },
          { key: "max_open_per_user", type: "number", default: "1", description: "Maximum number of open tickets per user" },
          {
            key: "messages", type: "object", description: "Customizable messages",
            children: [
              { key: "ticket_opened", type: "message", description: "DM sent to user when ticket is opened. Variable: {channel}" },
              { key: "ticket_already_open", type: "message", description: "When user tries to open a second ticket. Variable: {channel} = existing ticket" },
              { key: "ticket_blacklisted", type: "message", description: "When a blacklisted user tries to open a ticket. Variable: {reason}" },
              { key: "ticket_closed", type: "message", description: "Posted when a ticket is closed. Variables: {mod} {reason}" },
              { key: "ticket_claimed", type: "message", description: "Posted when a ticket is claimed. Variable: {mod}" },
              { key: "ticket_unclaimed", type: "message", description: "Posted when a ticket is unclaimed" },
              { key: "ticket_deleted", type: "message", description: "Posted when a ticket is deleted" },
              { key: "adduser_success", type: "message", description: "When a user is added to a ticket. Variable: {trigger} = user" },
              { key: "removeuser_success", type: "message", description: "When a user is removed from a ticket" },
              { key: "ticket_renamed", type: "message", description: "When a ticket channel is renamed" },
              { key: "blacklist_success", type: "message", description: "When a user is blacklisted from tickets" },
              { key: "unblacklist_success", type: "message", description: "When a user is removed from the blacklist" },
              { key: "blacklist_list_empty", type: "message", description: "When no users are blacklisted" },
              { key: "not_a_ticket", type: "message", description: "When a ticket command is run outside a ticket channel" },
              { key: "transcript_sent", type: "message", description: "Confirmation when transcript is sent" },
            ],
          },
        ],
        content: `The **Tickets** plugin provides a full support ticket system.`,
      },

      // ── MOD NICK ─────────────────────────────────────────────────────────────
      {
        id: "plugin-modnick",
        title: "Mod Nick",
        type: "plugin",
        configKey: "modnick",
        defaultConfig: `modnick:
  enabled: false
  default_name: "Moderated Nickname"
  random_names: []
  log_changes: true
  rules:
    hoist: true
    blank: true
    unreadable: true
    zalgo: true
    bad_words: true
    custom_patterns: []
  messages:
    nickname_changed: "{user} nickname changed to {trigger} | Rule: {reason}"
    nickname_changed_dm: "Your nickname in {server} was changed to {trigger} because it violated our nickname rules"`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable automatic nickname moderation" },
          { key: "default_name", type: "string", default: "Moderated Nickname", description: "Default nickname applied when a violation is detected" },
          { key: "random_names", type: "string[]", default: "[]", description: "If set, a random name from this list is used instead of default_name" },
          { key: "log_changes", type: "boolean", default: "true", description: "Log automatic nickname changes to the logging channel" },
          { key: "rules.hoist", type: "boolean", default: "true", description: "Block nicknames that start with special characters to appear at top of member list" },
          { key: "rules.blank", type: "boolean", default: "true", description: "Block blank or invisible nicknames" },
          { key: "rules.unreadable", type: "boolean", default: "true", description: "Block nicknames with too many unreadable characters" },
          { key: "rules.zalgo", type: "boolean", default: "true", description: "Block Zalgo text (combining character spam)" },
          { key: "rules.bad_words", type: "boolean", default: "true", description: "Block nicknames containing words from the bad_words automod list" },
          { key: "rules.custom_patterns", type: "string[]", default: "[]", description: "Custom regex patterns to block in nicknames" },
          {
            key: "messages", type: "object", description: "Customizable messages",
            children: [
              { key: "nickname_changed", type: "message", description: "Logged when a nickname is auto-changed. {trigger} = new name, {reason} = rule violated" },
              { key: "nickname_changed_dm", type: "message", description: "DM sent to the member whose nickname was changed" },
            ],
          },
        ],
        commands: [
          { trigger: "modnick", usage: "!modnick @user", description: "Manually apply the modnick rules to a user's nickname." },
        ],
        content: `The **Mod Nick** plugin automatically enforces nickname rules, changing violating nicknames to a configured default.

## Rules

| Rule | What it blocks |
|------|---------------|
| \`hoist\` | Nicknames starting with special characters to hoist to top of member list |
| \`blank\` | Empty or invisible nicknames |
| \`unreadable\` | Nicknames with excessive unreadable characters |
| \`zalgo\` | Zalgo / combining character text |
| \`bad_words\` | Nicknames containing words from the automod bad words list |
| \`custom_patterns\` | Any nickname matching a custom regex pattern |`,
      },

      // ── SLOWMODE AUTO ─────────────────────────────────────────────────────────
      {
        id: "plugin-slowmode-auto",
        title: "Slowmode Auto",
        type: "plugin",
        configKey: "slowmode_auto",
        defaultConfig: `slowmode_auto:
  enabled: false
  ignore_channels: []
  ignore_roles: []
  rules:
    - channel: null
      messages_per_seconds: 10
      window_seconds: 5
      apply_slowmode: 3
      remove_after_seconds: 30
      min_slowmode: 1
      max_slowmode: 120
  messages:
    slowmode_applied: "Slowmode of {count}s applied in {channel} due to high activity"
    slowmode_removed: "Slowmode removed in {channel}"`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable automatic slowmode" },
          { key: "ignore_channels", type: "string[]", default: "[]", description: "Channel IDs to never auto-slowmode" },
          { key: "ignore_roles", type: "string[]", default: "[]", description: "Messages from these roles do not count toward the threshold" },
          {
            key: "rules", type: "array", description: "List of auto-slowmode rules",
            children: [
              { key: "channel", type: "snowflake | null", description: "Channel to apply this rule to (null = all channels)" },
              { key: "messages_per_seconds", type: "number", description: "Number of messages within the window that triggers slowmode" },
              { key: "window_seconds", type: "number", description: "Time window in seconds" },
              { key: "apply_slowmode", type: "number", description: "Slowmode value in seconds to apply" },
              { key: "remove_after_seconds", type: "number", description: "Seconds of inactivity before removing slowmode" },
              { key: "min_slowmode", type: "number", description: "Minimum slowmode value (seconds)" },
              { key: "max_slowmode", type: "number", description: "Maximum slowmode value (seconds)" },
            ],
          },
        ],
        content: `The **Slowmode Auto** plugin automatically applies channel slowmode when message rate exceeds configured thresholds.`,
      },

      // ── DURATION ROLES ────────────────────────────────────────────────────────
      {
        id: "plugin-duration-roles",
        title: "Duration Roles",
        type: "plugin",
        configKey: "duration_roles",
        defaultConfig: `duration_roles:
  enabled: false
  roles:
    - role: null
      duration_days: 30
      dm_on_removal: true
      dm_warning_days: 3
      on_expiry: remove
      replace_with: null
  messages:
    role_expired: "{user} role {trigger} has expired"
    role_expiry_warning_dm: "Your {trigger} role in {server} expires in {count} days"
    role_expired_dm: "Your {trigger} role in {server} has expired"`,
        schema: [
          { key: "enabled", type: "boolean", default: "false", description: "Enable duration roles" },
          {
            key: "roles", type: "array", description: "List of time-limited role definitions",
            children: [
              { key: "role", type: "snowflake", description: "Role ID to manage" },
              { key: "duration_days", type: "number", description: "How many days the role lasts after being assigned" },
              { key: "dm_on_removal", type: "boolean", default: "true", description: "DM the member when the role is removed" },
              { key: "dm_warning_days", type: "number", description: "DM the member this many days before expiry as a warning (0 = no warning)" },
              { key: "on_expiry", type: "remove | replace", default: "remove", description: "What to do when the role expires" },
              { key: "replace_with", type: "snowflake | null", default: "null", description: "Role to give when this role expires (if on_expiry is replace)" },
            ],
          },
        ],
        content: `The **Duration Roles** plugin automatically removes roles after a configured time period, optionally replacing them with another role.`,
      },

      // ── REACTION ROLES ────────────────────────────────────────────────────────
      {
        id: "plugin-reaction-roles",
        title: "Reaction Roles",
        type: "plugin",
        configKey: "reaction_roles",
        defaultConfig: `reaction_roles:
  enabled: true
  messages:
    rr_created: "Panel {trigger} created"
    rr_entry_added: "Role {trigger} added to panel {reason}"
    rr_entry_removed: "Role {trigger} removed from panel {reason}"
    rr_posted: "Panel {trigger} posted in {channel}"
    rr_deleted: "Panel {trigger} deleted"
    rr_not_found: "Panel {trigger} not found"
    rr_list_empty: "No panels found"
    rr_max_reached: "You have reached the maximum roles for this panel"
    rr_missing_required: "You need {trigger} to use this panel"
    rr_role_given: "You have been given {trigger}"
    rr_role_removed: "You no longer have {trigger}"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable reaction roles" },
          {
            key: "messages", type: "object", description: "Customizable messages. Variable: {trigger} = panel name or role name",
            children: [
              { key: "rr_created", type: "message", description: "When a panel is created" },
              { key: "rr_entry_added", type: "message", description: "When a role is added to a panel. {trigger} = role, {reason} = panel name" },
              { key: "rr_entry_removed", type: "message", description: "When a role is removed from a panel" },
              { key: "rr_posted", type: "message", description: "When a panel is posted in a channel" },
              { key: "rr_deleted", type: "message", description: "When a panel is deleted" },
              { key: "rr_not_found", type: "message", description: "When a panel name doesn't exist" },
              { key: "rr_list_empty", type: "message", description: "When no panels are configured" },
              { key: "rr_max_reached", type: "message", description: "When the panel's role limit is reached" },
              { key: "rr_missing_required", type: "message", description: "When a user lacks a required role to use the panel. Variable: {trigger} = required role" },
              { key: "rr_role_given", type: "message", description: "Ephemeral confirmation when a role is given" },
              { key: "rr_role_removed", type: "message", description: "Ephemeral confirmation when a role is removed" },
            ],
          },
        ],
        content: `The **Reaction Roles** plugin provides emoji-based role self-assignment panels that persist through bot restarts.`,
      },

      // ── LEVELS ───────────────────────────────────────────────────────────────
      {
        id: "plugin-levels",
        title: "Levels",
        type: "plugin",
        configKey: "levels",
        defaultConfig: `levels:
  enabled: true`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable the levels plugin" },
        ],
        commands: [
          { trigger: "level", usage: "!level [@user]", description: "Show your level or another member's level." },
          { trigger: "levels", usage: "!levels", description: "Show the server level leaderboard." },
          { trigger: "levelset", usage: "!levelset @user", description: "Manually set a member's level." },
        ],
        content: `The **Levels** plugin provides manual level/rank tracking for server members.`,
      },

      // ── UTILITY ──────────────────────────────────────────────────────────────
      {
        id: "plugin-utility",
        title: "Utility",
        type: "plugin",
        configKey: "utility",
        defaultConfig: `utility:
  enabled: true
  custom_help_entries: []
  messages:
    banner_none: "{user} has no banner set"
    bansearch_not_found: "{trigger} is not banned"
    bansearch_invalid: "Invalid user ID"
    casesearch_none: "No cases found matching {trigger}"
    inrole_empty: "No members have that role"
    help_not_found: "Command {trigger} not found"`,
        schema: [
          { key: "enabled", type: "boolean", default: "true", description: "Enable utility commands" },
          { key: "custom_help_entries", type: "array", default: "[]", description: "Additional entries shown in the help command" },
          { key: "messages.banner_none", type: "message", description: "When a user has no banner. Variable: {user}" },
          { key: "messages.bansearch_not_found", type: "message", description: "When a user is not banned. Variable: {trigger} = user ID" },
          { key: "messages.bansearch_invalid", type: "message", description: "When an invalid user ID is provided to bansearch" },
          { key: "messages.casesearch_none", type: "message", description: "When no cases match the search. Variable: {trigger} = keyword" },
          { key: "messages.inrole_empty", type: "message", description: "When no members have the searched role" },
          { key: "messages.help_not_found", type: "message", description: "When help is requested for an unknown command" },
        ],
        commands: [
          { trigger: "userinfo", usage: "!userinfo [@user]", description: "Show detailed information about a user." },
          { trigger: "avatar", usage: "!avatar [@user]", description: "Show a user's avatar." },
          { trigger: "banner", usage: "!banner [@user]", description: "Show a user's profile banner." },
          { trigger: "roles", usage: "!roles [@user]", description: "List all roles a user has." },
          { trigger: "joined", usage: "!joined [@user]", description: "Show when a user joined the server." },
          { trigger: "firstmsg", usage: "!firstmsg [@user] [#channel]", description: "Show a user's first message in a channel." },
          { trigger: "bansearch", usage: "!bansearch <user_id>", description: "Check if a user is banned by ID." },
          { trigger: "casesearch", usage: "!casesearch <keyword>", description: "Search all cases by keyword." },
          { trigger: "warncount", usage: "!warncount [@user]", description: "Show total warning count for a user." },
          { trigger: "modstats", usage: "!modstats [@mod]", description: "Show moderation statistics for a moderator." },
          { trigger: "serverinfo", usage: "!serverinfo", description: "Show information about the server." },
          { trigger: "channelinfo", usage: "!channelinfo [#channel]", description: "Show information about a channel." },
          { trigger: "roleinfo", usage: "!roleinfo <@role>", description: "Show information about a role." },
          { trigger: "membercount", usage: "!membercount", description: "Show the current member count." },
          { trigger: "botstats", usage: "!botstats", description: "Show bot statistics (uptime, guilds, commands)." },
          { trigger: "botinfo", usage: "!botinfo", description: "Show bot version and info." },
          { trigger: "inviteinfo", usage: "!inviteinfo <code>", description: "Show information about a Discord invite code." },
          { trigger: "snowflake", usage: "!snowflake <id>", description: "Decode a Discord snowflake ID to show its creation date." },
          { trigger: "permissions", usage: "!permissions [@user] [#channel]", description: "Show a user's permissions in a channel." },
          { trigger: "inrole", usage: "!inrole <@role>", description: "List all members with a specific role." },
          { trigger: "charcount", usage: "!charcount <text>", description: "Count characters in text." },
          { trigger: "embed", usage: "!embed <json>", description: "Post a custom embed from a JSON object." },
          { trigger: "help", usage: "!help [command]", description: "Show all commands, or detailed help for a specific command." },
        ],
        content: `The **Utility** plugin provides informational and quality-of-life commands.`,
      },
    ],
  },
];
