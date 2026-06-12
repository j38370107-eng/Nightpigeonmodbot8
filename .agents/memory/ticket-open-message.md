---
name: Ticket open message
description: How the customizable ticket welcome message flows
---
- Stored in ticketConfig DB key as field `openMessage?: string`
- TicketGuildConfig interface in tickets.ts has `openMessage?: string`
- buildTicketEmbed(userTag, customMessage?) in ticketButtons.ts — falls back to hardcoded default if blank
- Dashboard: Settings tab in Tickets page, plain textarea, saved with updateTicketConfig
