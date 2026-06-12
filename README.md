# UtilityPalse — Discord Moderation Bot

A feature-rich Discord moderation bot built with **Node.js**, **TypeScript**, and **discord.js v14**.

---

## Features

### Moderation
| Command | Description |
|---|---|
| `>ban @user [reason]` | Ban a member |
| `>unban <userID> [reason]` | Unban a member |
| `>kick @user [reason]` | Kick a member |
| `>mute @user <duration> [reason]` | Timeout a member (e.g. `10m`, `1h`, `7d`) |
| `>unmute @user [reason]` | Remove timeout |
| `>warn @user [reason]` | Issue a warning |
| `>warnings @user [-a]` | View infractions (`-a` for AutoMod only) |
| `>purge <amount>` | Bulk delete messages |
| `>slowmode <seconds>` | Set channel slowmode |
| `>lock / >unlock` | Lock/unlock a channel |
| `>lockdown [end]` | Lock/unlock all configured channels |
| `>note @user <text>` | Add a private mod note |
| `>case <id>` | View a specific case |
| `>reason <id> <text>` | Edit a case reason |
| `>delcase <id>` | Delete a case |
| `>addrole / >removerole @user @role` | Add or remove a role |
| `>nick @user <nickname>` | Change a member's nickname |
| `>modnick @user <nickname>` | Force a moderation nickname |

### Auto-Mod
| Command | Description |
|---|---|
| `>automod` | View/manage AutoMod settings |

Detects: word filter, invite links, mention spam, message spam, duplicate messages.  
Punishment escalation fully configurable per guild.

### Anti-Nuke
Protects against mass destructive actions (channel/role deletes, mass bans/kicks, webhook spam).

| Command | Description |
|---|---|
| `>antinuke enable / disable` | Toggle protection |
| `>antinuke action <ban\|kick\|strip>` | Action taken against the nuker |
| `>antinuke threshold <type> <count>` | Set trigger threshold per action type |
| `>antinuke window <seconds>` | Detection window |
| `>antinuke whitelist add/remove @user` | Whitelist trusted admins |
| `>antinuke status` | View current config |

### Anti-Raid
Detects mass joins and responds automatically.

| Command | Description |
|---|---|
| `>antiraid enable / disable` | Toggle protection |
| `>antiraid action <ban\|kick\|mute>` | Action taken against raiders |
| `>antiraid threshold <count>` | Joins needed to trigger |
| `>antiraid window <seconds>` | Detection window |
| `>antiraid lockdown <on\|off>` | Auto-lock channels on raid |
| `>antiraid status` | View current config |

### Server Logging
| Command | Description |
|---|---|
| `>setmodlogs #channel` | Set the moderation log channel |
| `>setserverlogs #channel` | Set the server activity log channel |

Server logs cover: message edits/deletes, member join/leave, bans/unbans, nickname & role changes, channel/role create/edit/delete, voice state changes.

### Configuration
| Command | Description |
|---|---|
| `>changeprefix <prefix>` | Change the command prefix (default: `>`) |
| `>modrole @role` | Set the moderator role |
| `>setexpiredate <months>` | Set how long warnings last |
| `>shortcut` | Create punishment shortcuts (e.g. `>toxicwarn`) |
| `>alias add <alias> <command>` | Create custom command aliases |

### Utility
| Command | Description |
|---|---|
| `>userinfo @user` | Show user information |
| `>serverinfo` | Show server information |
| `>afk [reason]` | Set AFK status |
| `>remind <time> <message>` | Set a reminder |
| `>alt @user / >clearalt @user` | Flag/clear alt accounts |
| `>ping` | Check bot latency |
| `>help [command]` | Show help |

---

## Setup

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A Discord bot token ([create one here](https://discord.com/developers/applications))

### Required Bot Permissions
Enable the following in the Discord Developer Portal:
- **Privileged Gateway Intents:** Server Members Intent, Message Content Intent
- **Bot Permissions:** Administrator (or at minimum: Ban Members, Kick Members, Moderate Members, Manage Channels, Manage Roles, View Audit Log, Read/Send Messages, Manage Messages)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/your-repo-name.git
cd your-repo-name

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env and add your DISCORD_BOT_TOKEN

# Run in development
pnpm --filter @workspace/api-server run dev
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_BOT_TOKEN` | ✅ Yes | Your bot token from the Discord Developer Portal |
| `PORT` | No | HTTP server port (default: `8080`) |

### Data Storage

The bot persists all data as JSON files in the `data/` directory (auto-created on first run):

| File | Contents |
|---|---|
| `settings.json` | Per-guild settings (prefix, log channels, etc.) |
| `infractions.json` | All moderation cases |
| `shortcuts.json` | Custom punishment shortcuts |
| `aliases.json` | Custom command aliases |
| `automod.json` | AutoMod configuration |
| `antinuke.json` | Anti-Nuke configuration |
| `antiraid.json` | Anti-Raid configuration |
| `lockdown.json` | Lockdown channel lists |
| `alts.json` | Alt account flags |

> These files are excluded from git (see `.gitignore`). Back them up if you need to preserve server data.

---

## Project Structure

```
artifacts/api-server/
├── src/
│   ├── bot/
│   │   ├── commands/      # All bot commands
│   │   ├── events/        # Discord event handlers
│   │   ├── lib/           # Shared utilities (modlog, serverlog, dmNotify…)
│   │   └── store/         # Data persistence layer
│   └── index.ts           # HTTP server + bot entry point
├── build.mjs              # esbuild bundler config
├── package.json
└── tsconfig.json
data/                      # Runtime JSON data (gitignored)
```

---

## License

MIT
