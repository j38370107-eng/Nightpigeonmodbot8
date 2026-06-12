import { Message, PermissionFlagsBits } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";
import { addInfraction } from "../store/infractions";
import { sendDmNotification } from "../lib/dmNotify";
import { resolveTarget, getArgs } from "../lib/resolveUser";
import { addTimedBan, scheduleTimedBan } from "../store/timedBans";
import { getExecutorMember, isHierarchyBlocked } from "../lib/hierarchy";
import { getAdditionalInfo } from "../store/additionalInfo";
import { promptAltPunishment } from "../lib/altPrompt";

const DURATION_RE = /^(\d+)(s|m|h|d)$/i;

function parseDurationSeconds(input: string): number | null {
  const match = input.match(DURATION_RE);
  if (!match) return null;
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
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

function parseAdditionalInfo(text: string): { reason: string; additionalInfo?: string } {
  const pipeIdx = text.indexOf("|");
  if (pipeIdx === -1) return { reason: text.trim() || "No reason provided" };
  return {
    reason: text.slice(0, pipeIdx).trim() || "No reason provided",
    additionalInfo: text.slice(pipeIdx + 1).trim() || undefined,
  };
}

export const banCommand: Command = {
  name: "ban",
  aliases: [],
  description: "Ban a member from the server (optionally for a set duration)",
  usage: "<@user | userID> [-s] [duration: 1h/7d] [reason] [| additional info]",
  requiredPermissions: [PermissionFlagsBits.BanMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const silent = args.includes("-s") || args.includes("--silent");
    const filteredArgs = args.filter((a) => a !== "-s" && a !== "--silent");

    const resolved = await resolveTarget(message, filteredArgs);
    if (!resolved) return message.reply(usageErr(message, banCommand, "Mention a user or provide a valid user ID"));

    const { user: target, member } = resolved;

    if (member && !member.bannable) {
      return message.reply("❌ I cannot ban this user — they may have a higher role than me.");
    }

    if (member) {
      const executorMember = await getExecutorMember(message);
      if (executorMember && isHierarchyBlocked(executorMember, member)) {
        return message.reply("❌ You cannot ban someone with an equal or higher role than you.");
      }
    }

    // Check if first arg after user is a duration
    const rest = getArgs(message, filteredArgs);
    let durationSeconds: number | null = null;
    let rawText: string;

    if (rest[0] && DURATION_RE.test(rest[0])) {
      durationSeconds = parseDurationSeconds(rest[0]);
      rawText = rest.slice(1).join(" ");
    } else {
      rawText = rest.join(" ");
    }

    const { reason, additionalInfo } = parseAdditionalInfo(rawText);

    const MAX_BAN_SECONDS = 30 * 24 * 3600; // 30 days
    if (durationSeconds && durationSeconds > MAX_BAN_SECONDS) {
      return message.reply("❌ Max ban duration is 30 days. Omit the duration for a permanent ban.");
    }

    const expiresAt = durationSeconds ? Date.now() + durationSeconds * 1000 : undefined;
    const duration = durationSeconds ? formatDuration(durationSeconds) : undefined;

    const dmAdditionalInfo = additionalInfo ?? getAdditionalInfo(message.guild.id, "ban");

    try {
      const infraction = addInfraction(message.guild.id, target.id, {
        type: "Ban",
        reason,
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
        expiresAt,
      });

      await sendDmNotification(target, {
        action: "Banned",
        guildName: message.guild.name,
        reason,
        additionalInfo: dmAdditionalInfo,
        duration,
        expiresAt,
        caseId: infraction.id,
        description: false,
      });

      await message.guild.members.ban(target.id, {
        reason: `${reason} | Banned by ${message.author.tag}`,
        deleteMessageSeconds: 604800,
      });

      // Schedule auto-unban if timed
      if (durationSeconds && expiresAt) {
        const timedBan = {
          guildId: message.guild.id,
          userId: target.id,
          userTag: target.tag,
          reason,
          expiresAt,
          moderatorId: message.author.id,
          moderatorTag: message.author.tag,
        };
        addTimedBan(timedBan);
        scheduleTimedBan(message.client, timedBan);
      }

      if (!silent) await message.channel.send(`Banned ${target}.\n(${infraction.id})`);
      await message.delete().catch(() => {});

      await sendModLog(message.client, message.guild.id, {
        action: durationSeconds ? `Member Banned (${duration})` : "Member Banned (Permanent)",
        executor: { tag: message.author.tag, id: message.author.id },
        target: { tag: target.tag, id: target.id },
        channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
        reason,
        color: 0xe74c3c,
        caseId: infraction.id,
      });

      logger.info({ targetId: target.id, reason, caseId: infraction.id, durationSeconds }, "User banned");

      await promptAltPunishment(message, target.id, "banned", async (altId) => {
        await message.guild!.members.ban(altId, {
          reason: `Alt of banned user ${target.tag} | Banned by ${message.author.tag}`,
          deleteMessageSeconds: 604800,
        });
        await message.channel.send(`Also banned alt <@${altId}>.`);
      });
    } catch (err) {
      logger.error({ err }, "Failed to ban user");
      await message.reply("❌ Failed to ban the user.");
    }
  },
};
