import { Message, PermissionFlagsBits, TextChannel } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";

function formatSeconds(s: number): string {
  if (s === 0) return "disabled";
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(s / 3600);
  return `${h} hour${h === 1 ? "" : "s"}`;
}

/** Parse a value like "5", "5s", "10m", "2h" into seconds. Returns NaN on failure. */
function parseValue(raw: string): number {
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(s|m|h)?$/i);
  if (!match) return NaN;
  const num = parseFloat(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  if (unit === "m") return Math.round(num * 60);
  if (unit === "h") return Math.round(num * 3600);
  return Math.round(num);
}

/** Resolve a channel mention (#channel) or raw ID to a TextChannel, or null. */
function resolveTextChannel(message: Message, raw: string): TextChannel | null {
  const id = raw.replace(/^<#(\d+)>$/, "$1").trim();
  if (!/^\d+$/.test(id)) return null;
  const ch = message.guild?.channels.cache.get(id);
  if (!ch || !("setRateLimitPerUser" in ch)) return null;
  return ch as TextChannel;
}

export const slowmodeCommand: Command = {
  name: "slowmode",
  aliases: ["slow", "sm"],
  description: "Set, adjust, or view slowmode delay for a channel",
  usage: "[+/-][value][s/m/h] [#channel | channel-id]  e.g. 5m · +30s · -1m #general · 2h 123456789",
  requiredPermissions: [],

  async execute(message: Message, args: string[]) {
    // No args — view current channel's slowmode (anyone can do this)
    if (!args[0]) {
      const ch = message.channel as TextChannel;
      if (!("setRateLimitPerUser" in ch)) {
        return message.reply("❌ This command can only be used in a text channel.");
      }
      const current = ch.rateLimitPerUser ?? 0;
      return message.reply(
        current === 0
          ? `The current slowmode in <#${ch.id}> is **disabled**.`
          : `The current slowmode in <#${ch.id}> is **${formatSeconds(current)}**.`
      );
    }

    // If the only arg looks like a channel mention or ID, treat it as a view request
    const looksLikeChannel = /^<#\d+>$/.test(args[0]) || (/^\d{17,20}$/.test(args[0]) && !args[1]);
    if (looksLikeChannel && !args[1]) {
      const resolved = resolveTextChannel(message, args[0]);
      if (!resolved) {
        return message.reply("❌ Couldn't find that channel. Use a `#mention` or a valid channel ID.");
      }
      const current = resolved.rateLimitPerUser ?? 0;
      return message.reply(
        current === 0
          ? `The current slowmode in <#${resolved.id}> is **disabled**.`
          : `The current slowmode in <#${resolved.id}> is **${formatSeconds(current)}**.`
      );
    }

    // Setting/adjusting slowmode requires ManageChannels
    const canManage = message.member?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;
    if (!canManage) {
      return message.reply("❌ You don't have permission to change slowmode.");
    }

    // Parse time arg (args[0])
    const raw = args[0].trim();
    const relative = raw.startsWith("+") || raw.startsWith("-");
    const sign = raw.startsWith("-") ? -1 : 1;
    const stripped = raw.replace(/^[+-]/, "");

    const delta = parseValue(stripped);
    if (isNaN(delta) || delta < 0) {
      return message.reply(
        usageErr(message, slowmodeCommand, "Use a number with optional unit: `5s`, `10m`, `2h`, `+30s`, `-1m`")
      );
    }

    // Resolve target channel — args[1] if provided, else current channel
    let target: TextChannel;
    if (args[1]) {
      const resolved = resolveTextChannel(message, args[1]);
      if (!resolved) {
        return message.reply("❌ Couldn't find that channel. Use a `#mention` or a valid channel ID.");
      }
      target = resolved;
    } else {
      if (!("setRateLimitPerUser" in message.channel)) {
        return message.reply("❌ This command can only be used in a text channel.");
      }
      target = message.channel as TextChannel;
    }

    const current = target.rateLimitPerUser ?? 0;
    let seconds = relative ? current + sign * delta : delta;

    // Clamp to Discord's allowed range (0–21600 seconds / 6 hours)
    seconds = Math.max(0, Math.min(21600, seconds));

    try {
      await target.setRateLimitPerUser(seconds, `Set by ${message.author.tag}`);

      await message.reply(
        seconds === 0
          ? `Slowmode has been **disabled** in <#${target.id}>.`
          : `Slowmode set to **${formatSeconds(seconds)}** in <#${target.id}>.`
      );

      if (message.guild) {
        await sendModLog(message.client, message.guild.id, {
          action: seconds === 0 ? "Slowmode Disabled" : `Slowmode Set (${formatSeconds(seconds)})`,
          executor: { tag: message.author.tag, id: message.author.id },
          channel: { name: target.name, id: target.id },
          color: 0x9b59b6,
        });
      }

      logger.info({ seconds, relative, channelId: target.id }, "Slowmode set");
    } catch (err) {
      logger.error({ err }, "Failed to set slowmode");
      await message.reply("❌ Failed to set slowmode.");
    }
  },
};
