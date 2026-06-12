---
name: Project stack
description: Core tech stack, monorepo layout, and known environment quirks
---
- discord.js v14, TypeScript, esbuild bundle; Express 5 API server; React + Vite dashboard
- pnpm monorepo: artifacts/api-server (bot + REST), artifacts/dashboard (React SPA + server-side Express)
- PostgreSQL via `bot_store` table, read/written through dbGet/dbSet helpers in both workspaces
- Workflows: "Dylan Deadly Nights Bot" (port 3000), "Dashboard Dev" (DASHBOARD_PORT=5000)
- Bot token is INVALID (pre-existing) — bot always fails TokenInvalid; REST API + dashboard work independently
