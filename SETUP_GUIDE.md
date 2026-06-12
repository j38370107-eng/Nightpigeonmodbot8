# UtilityPalse Dashboard — Render Setup Guide

You will deploy **two separate Web Services** on Render — the bot and the dashboard — sharing one PostgreSQL database.

---

## Step 1 — Create a Discord Application

1. Go to https://discord.com/developers/applications → **New Application**
2. Under **Bot** tab → **Add Bot** → copy the **Bot Token**
3. Under **OAuth2 → General**, add this redirect URI:
   ```
   https://YOUR-DASHBOARD-URL.onrender.com/api/auth/callback
   ```
   *(Fill in the real URL after deploying in Step 4)*
4. Copy your **Client ID** and **Client Secret** from OAuth2 → General

---

## Step 2 — Create a PostgreSQL Database on Render

1. Render dashboard → **New → PostgreSQL**
2. Name it (e.g. `utilitypulse-db`) and choose a plan
3. After creation, copy the **External Database URL** — you'll paste it into both services

---

## Step 3 — Deploy the Bot

1. **New → Web Service** → connect your GitHub repo
2. Settings:

   | Field | Value |
   |-------|-------|
   | **Root Directory** | `artifacts/api-server` |
   | **Runtime** | Node |
   | **Build Command** | `corepack enable && pnpm install && pnpm run build` |
   | **Start Command** | `pnpm run start` |

3. Environment variables:

   | Key | Value |
   |-----|-------|
   | `DISCORD_BOT_TOKEN` | Bot token from Step 1 |
   | `DATABASE_URL` | PostgreSQL URL from Step 2 |
   | `PORT` | `3000` |

4. Deploy and copy the service URL (e.g. `https://utilitypulse-bot.onrender.com`)

---

## Step 4 — Deploy the Dashboard

1. **New → Web Service** → connect the same repo
2. Settings:

   | Field | Value |
   |-------|-------|
   | **Root Directory** | `artifacts/dashboard` |
   | **Runtime** | Node |
   | **Build Command** | `` |
   | **Start Command** | `pnpm run start` |

3. Environment variables:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Same PostgreSQL URL from Step 2 |
   | `DISCORD_CLIENT_ID` | Client ID from Step 1 |
   | `DISCORD_CLIENT_SECRET` | Client Secret from Step 1 |
   | `SESSION_SECRET` | A random string — see below |
   | `DASHBOARD_URL` | `https://your-dashboard.onrender.com` (this service's URL) |
   | `DISCORD_BOT_TOKEN` | Bot token (needed for channels, roles & audit log) |
   | `BOT_API_URL` | Bot's Render URL from Step 3 (optional, for live stats) |
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |

4. Deploy

---

## Step 5 — Finish Discord OAuth Setup

1. Back in https://discord.com/developers/applications → your app → **OAuth2 → General**
2. Make sure the redirect URI matches **exactly**:
   ```
   https://your-dashboard.onrender.com/api/auth/callback
   ```
3. Save changes

---

## Step 6 — Invite the Bot to Your Server

Replace `CLIENT_ID` with your actual client ID:
```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot
```

---

## Step 7 — Test It

1. Visit your dashboard URL
2. Click **Login with Discord**
3. Select your server and start configuring!

---

## Generating a SESSION_SECRET

Run in any terminal:
```bash
openssl rand -base64 32
```
Or use any password generator to create a 32+ character random string.

---

## Troubleshooting

**Build fails — "Use pnpm instead"**
→ The build command must start with `corepack enable && pnpm install`. Do not use plain `npm install` — the project enforces pnpm.

**Build fails — EROFS / read-only file system**
→ Do not use `npm install -g pnpm`. Use `corepack enable` instead — it activates pnpm without a global install.

**"Access denied to this server"**
→ You must have Manage Server or Administrator permission in the Discord server.

**OAuth redirect mismatch**
→ The redirect URI in Discord must match `DASHBOARD_URL` + `/api/auth/callback` exactly, including `https://`.

**Channels / roles / audit log not loading**
→ `DISCORD_BOT_TOKEN` must be set in the dashboard's env vars, and the bot must be in the server.

**Bot shows offline on dashboard**
→ Set `BOT_API_URL` to the bot's Render URL. Both services must be running.

**Free tier sleeps after 15 minutes**
→ Render's free plan spins down on inactivity. The first request after sleep takes ~30s. Upgrade to a paid plan to keep it always-on.

---

## Dashboard Pages Reference

| Page | What it does |
|------|-------------|
| **Home** | Public landing page with live bot stats |
| **Overview** | Server stats, quick actions, bot status |
| **Shortcuts** | Create shortcuts like `spam` → mute 1h |
| **Command Modules** | Enable/disable any command per server |
| **Permissions** | Restrict commands to specific roles/channels |
| **Case Log** | All moderation cases with detail view |
| **Active Punishments** | Timed bans/mutes with countdown timers |
| **AutoMod** | Word filter, spam detection, escalation steps |
| **Server Logging** | Choose what events get logged and where |
| **Audit Log** | Discord's audit log inside the dashboard |
| **Applications** | Up to 5 custom forms (ban appeals, staff apps) |
| **Settings** | Prefix, log channels, warn expiry |
