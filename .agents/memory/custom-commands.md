---
name: Custom commands store
description: How custom commands are stored, capped, and triggered
---
- Store key: "customCommands" (per guild), shape: Record<id, {id,trigger,response,createdAt}>
- Cap: 50 per guild enforced in both API route and dashboard
- Trigger: lowercase, no spaces (spaces → underscores), matched in messageCreate event
- Dashboard presets: "warm" (fake warn) and "bam" (fake ban)
- **Why:** user-configurable auto-responses without needing bot restarts
