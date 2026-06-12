import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { resolveTarget, getArgs } from "../lib/resolveUser";
import { getInfractions } from "../store/infractions";
import {
  getAllTimedBans,
  removeTimedBan,
  addTimedBan,
  scheduleTimedBan,
} from "../store/timedBans";
import { addTimedMute, removeTimedMute, scheduleTimedMute } from "../store/timedMutes";
import { logger } from "../../lib/logger";

const DURATION_RE = /^(\d+)(s|m|h|d|w)$/i;

function parseDurationSeconds(input: string): number | null {
  const match = input.match(DURATION_RE);
  if (!match) return null;
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };
  return value * (multipliers[unit] ?? 1);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(seconds / 3600);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.floor(seconds / 86400);
  return `${d} day${d === 1 ? "" : "s"}`;
}

export const durationCommand: Command = {
  name: "duration",
  aliases: ["setduration", "changeduration"],
  description: "Change the remaining duration of an active mute or timed ban",
  usage: "<mute | ban> <@user | userID> <new duration>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const sub = args[0]?.toLowerCase();
    if (sub !== "mute" && sub !== "ban") {
      return message.reply(usageErr(message, durationCommand, "Specify mute or ban"));
    }

    const shiftedArgs = args.slice(1);
    const resolved = await resolveTarget(message, shiftedArgs);
    if (!resolved)
      return message.reply(usageErr(message, durationCommand, "Mention a user or provide a valid user ID"));

    const { user: target, member } = resolved;
    const durationStr = getArgs(message, shiftedArgs)[0];
    if (!durationStr)
      return message.reply(usageErr(message, durationCommand, "Provide a new duration (e.g. 30m, 2h, 7d)"));

    const seconds = parseDurationSeconds(durationStr);
    if (!seconds)
      return message.reply(usageErr(message, durationCommand, "Invalid duration — use e.g. 30m, 2h, 1d, 1w"));

    const newExpiresAt = Date.now() + seconds * 1000;

    if (sub === "mute") {
      if (!member)
        return message.reply("❌ That user is not in this server.");
      if (!member.isCommunicationDisabled())
        return message.reply("❌ That user is not currently muted.");
      if (seconds > 2419200)
        return message.reply(
          "❌ Discord timeout maximum is 28 days.",
        );

      try {
        await member.disableCommunicationUntil(
          newExpiresAt,
          `Duration changed by ${message.author.tag}`,
        );

        const infractions = getInfractions(message.guild.id, target.id);
        const activeMute = infractions
          .filter(
            (i) =>
              i.type === "Mute" && i.expiresAt && i.expiresAt > Date.now(),
          )
          .at(-1);
        if (activeMute) activeMute.expiresAt = newExpiresAt;

        removeTimedMute(message.guild.id, target.id);
        const updatedMute = { guildId: message.guild.id, userId: target.id, guildName: message.guild.name, expiresAt: newExpiresAt };
        addTimedMute(updatedMute);
        scheduleTimedMute(message.client, updatedMute);

        const embed = new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle("✅ Mute Duration Updated")
          .addFields(
            { name: "User", value: `<@${target.id}>`, inline: true },
            {
              name: "New Duration",
              value: formatDuration(seconds),
              inline: true,
            },
            {
              name: "Expires",
              value: `<t:${Math.floor(newExpiresAt / 1000)}:F>`,
              inline: false,
            },
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      } catch (err) {
        logger.error({ err }, "Failed to update mute duration");
        return message.reply("❌ Failed to update the mute duration.");
      }
    }

    if (sub === "ban") {
      const allBans = getAllTimedBans();
      const timedBan = allBans.find(
        (b) => b.guildId === message.guild!.id && b.userId === target.id,
      );
      if (!timedBan)
        return message.reply(
          "❌ No active timed ban found for that user. Only timed bans can have their duration changed.",
        );

      removeTimedBan(message.guild.id, target.id);
      const updatedBan = { ...timedBan, expiresAt: newExpiresAt };
      addTimedBan(updatedBan);
      scheduleTimedBan(message.client, updatedBan);

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("✅ Ban Duration Updated")
        .addFields(
          { name: "User", value: `<@${target.id}>`, inline: true },
          {
            name: "New Duration",
            value: formatDuration(seconds),
            inline: true,
          },
          {
            name: "Expires",
            value: `<t:${Math.floor(newExpiresAt / 1000)}:F>`,
            inline: false,
          },
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }
  },
};
