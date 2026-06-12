import { Message } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { logger } from "../../lib/logger";

const DURATION_RE = /^(\d+)(s|m|h|d)$/i;

function parseDurationMs(input: string): number | null {
  const match = input.match(DURATION_RE);
  if (!match) return null;
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] ?? 1000);
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)} second${Math.round(ms / 1000) === 1 ? "" : "s"}`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} minute${Math.round(ms / 60000) === 1 ? "" : "s"}`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)} hour${Math.round(ms / 3600000) === 1 ? "" : "s"}`;
  return `${Math.round(ms / 86400000)} day${Math.round(ms / 86400000) === 1 ? "" : "s"}`;
}

export const remindCommand: Command = {
  name: "remind",
  aliases: ["reminder", "remindme"],
  description: "Set a reminder. The bot will mention you after the time.",
  usage: "<time: 10s/5m/2h/1d> <message>",
  requiredPermissions: [],

  async execute(message: Message, args: string[]) {
    const timeArg = args[0];
    if (!timeArg) return message.reply(usageErr(message, remindCommand, "Provide a time and message"));

    const ms = parseDurationMs(timeArg);
    if (!ms) return message.reply(usageErr(message, remindCommand, "Invalid time format — use e.g. 10s, 5m, 2h, 1d"));
    if (ms > 7 * 24 * 3600000) return message.reply("❌ Reminders can be at most 7 days.");

    const reminder = args.slice(1).join(" ").trim();
    if (!reminder) return message.reply(usageErr(message, remindCommand, "Include a reminder message"));

    const fireAt = Math.floor((Date.now() + ms) / 1000);
    await message.reply(`⏰ Got it! I'll remind you in **${formatDuration(ms)}** (<t:${fireAt}:R>).`);

    setTimeout(async () => {
      try {
        await message.channel.send(
          `⏰ <@${message.author.id}> Reminder: **${reminder}**`
        );
      } catch (err) {
        logger.error({ err }, "Failed to send reminder");
        try {
          await message.author.send(`⏰ Reminder: **${reminder}**`);
        } catch {}
      }
    }, ms);
  },
};
