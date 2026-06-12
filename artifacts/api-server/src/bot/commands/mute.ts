import { Message, PermissionFlagsBits } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";
import { addInfraction } from "../store/infractions";
import { sendDmNotification } from "../lib/dmNotify";
import { resolveTarget, getArgs } from "../lib/resolveUser";
import { addTimedMute, scheduleTimedMute } from "../store/timedMutes";
import { getExecutorMember, isHierarchyBlocked } from "../lib/hierarchy";
import { getAdditionalInfo } from "../store/additionalInfo";
import { promptAltPunishment } from "../lib/altPrompt";
import { getMuteConfig } from "../store/muteConfig";

function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
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
  const weeks = Math.floor(d / 7);
  const days = d % 7;
  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks} week${weeks === 1 ? "" : "s"}`);
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function parseAdditionalInfo(text: string): {
  reason: string;
  additionalInfo?: string;
} {
  const pipeIdx = text.indexOf("|");
  if (pipeIdx === -1) return { reason: text.trim() || "No reason provided" };
  return {
    reason: text.slice(0, pipeIdx).trim() || "No reason provided",
    additionalInfo: text.slice(pipeIdx + 1).trim() || undefined,
  };
}

export const muteCommand: Command = {
  name: "mute",
  aliases: ["timeout"],
  description: "Mute a member (timeout or mute role depending on server settings)",
  usage:
    "<@user | userID> [-s] [duration: 1s/5m/2h/1d] <reason> [| additional info]  — duration optional in role mode (omit for permanent)",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const silent = args.includes("-s") || args.includes("--silent");
    const filteredArgs = args.filter((a) => a !== "-s" && a !== "--silent");

    const resolved = await resolveTarget(message, filteredArgs);
    if (!resolved)
      return message.reply(usageErr(message, muteCommand, "Mention a user or provide a valid user ID"));

    const { user: target, member } = resolved;
    const rest = getArgs(message, filteredArgs);

    if (!member) return message.reply("❌ That user is not in this server.");

    const executorMember = await getExecutorMember(message);
    if (executorMember && isHierarchyBlocked(executorMember, member)) {
      return message.reply("❌ You cannot mute someone with an equal or higher role than you.");
    }

    const guildId = message.guild.id;
    const muteCfg = getMuteConfig(guildId);

    try {
      // ── Role mode ─────────────────────────────────────────────────────────
      if (muteCfg.mode === "role") {
        if (!muteCfg.muteRoleId) {
          return message.reply(
            "❌ No mute role configured. Run `>muteconfig role create` or `>muteconfig role set @role`, then `>muteconfig mode role`.",
          );
        }
        const muteRole = message.guild.roles.cache.get(muteCfg.muteRoleId);
        if (!muteRole) {
          return message.reply(
            "❌ Mute role not found — it may have been deleted. Re-run `>muteconfig role create`.",
          );
        }

        // Duration is optional in role mode — try parsing first arg as duration
        let seconds: number | null = null;
        let rawText: string;

        const maybeDuration = rest[0];
        if (maybeDuration) {
          const parsed = parseDuration(maybeDuration);
          if (parsed !== null && parsed > 0) {
            seconds = parsed;
            rawText = rest.slice(1).join(" ");
          } else {
            // First arg isn't a duration — treat everything as the reason (permanent mute)
            rawText = rest.join(" ");
          }
        } else {
          rawText = "";
        }

        const { reason, additionalInfo } = parseAdditionalInfo(rawText);
        const MAX_ROLE_MUTE_SECONDS = 30 * 24 * 3600; // 30 days
        if (seconds !== null && seconds > MAX_ROLE_MUTE_SECONDS) {
          return message.reply("❌ Max mute duration is 30 days. Omit the duration for a permanent mute.");
        }

        const isPermanent = seconds === null;
        const expiresAt = isPermanent ? null : Date.now() + seconds! * 1000;
        const duration = isPermanent ? "Permanent" : formatDuration(seconds!);

        let strippedRoles: string[] | undefined;

        if (muteCfg.stripRoles) {
          strippedRoles = member.roles.cache
            .filter((r) => r.id !== message.guild!.id && r.id !== muteRole.id)
            .map((r) => r.id);
          await member.roles.set([muteRole.id], `${reason} | Muted by ${message.author.tag}`);
        } else {
          await member.roles.add(muteRole, `${reason} | Muted by ${message.author.tag}`);
        }

        const infraction = addInfraction(guildId, target.id, {
          type: "Mute",
          reason,
          moderatorId: message.author.id,
          moderatorTag: message.author.tag,
          expiresAt: expiresAt ?? undefined,
        });

        const timedMute = {
          guildId,
          userId: target.id,
          guildName: message.guild.name,
          expiresAt,
          strippedRoles,
        };
        addTimedMute(timedMute);
        if (!isPermanent) scheduleTimedMute(message.client, timedMute);

        const dmAdditionalInfo = additionalInfo ?? getAdditionalInfo(guildId, "mute");
        await sendDmNotification(target, {
          action: "Muted",
          guildName: message.guild.name,
          reason,
          caseId: infraction.id,
          duration,
          expiresAt: expiresAt ?? undefined,
          additionalInfo: dmAdditionalInfo,
        });

        if (!silent) await message.channel.send(`Muted ${target}${isPermanent ? " (permanent)" : ` (${duration})`}.\n(${infraction.id})`);
        await message.delete().catch(() => {});

        await sendModLog(message.client, guildId, {
          action: isPermanent
            ? "Member Muted — Role (Permanent)"
            : `Member Muted — Role (${duration})`,
          executor: { tag: message.author.tag, id: message.author.id },
          target: { tag: target.tag, id: target.id },
          channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
          reason,
          color: 0xf39c12,
          caseId: infraction.id,
        });

        logger.info({ targetId: target.id, seconds, reason, caseId: infraction.id, permanent: isPermanent }, "User muted (role mode)");

        await promptAltPunishment(message, target.id, "muted", async (altId) => {
          const altMember = await message.guild!.members.fetch(altId).catch(() => null);
          if (!altMember) { await message.channel.send(`⚠️ Alt <@${altId}> is not in this server, skipping.`); return; }
          await altMember.roles.add(muteRole, `Alt of muted user ${target.tag} | Muted by ${message.author.tag}`);
          await message.channel.send(`Also muted alt <@${altId}>.`);
        });
        return;
      }

      // ── Timeout mode (default) — duration is required ──────────────────────
      const durationArg = rest[0];

      if (!durationArg)
        return message.reply(usageErr(message, muteCommand, "Specify a duration (e.g. 5m, 2h, 28d)"));

      const seconds = parseDuration(durationArg);
      if (!seconds || seconds <= 0) {
        return message.reply(usageErr(message, muteCommand, "Invalid duration — use e.g. 5m, 2h, 28d"));
      }

      const rawText = rest.slice(1).join(" ");
      const { reason, additionalInfo } = parseAdditionalInfo(rawText);

      if (!member.moderatable) {
        return message.reply(
          "❌ I cannot mute this user — they may have a higher role than me.",
        );
      }

      const MAX_TIMEOUT_SECONDS = 28 * 24 * 3600; // 28 days — Discord API hard limit
      if (seconds > MAX_TIMEOUT_SECONDS) {
        return message.reply("❌ Max duration for timeout mode is 28 days (Discord limit). Use mute role mode for permanent mutes.");
      }

      const expiresAt = Date.now() + seconds * 1000;
      const duration = formatDuration(seconds);

      const infraction = addInfraction(guildId, target.id, {
        type: "Mute",
        reason,
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
        expiresAt,
      });

      await member.timeout(
        seconds * 1000,
        `${reason} | Muted by ${message.author.tag}`,
      );

      const timedMute = {
        guildId,
        userId: target.id,
        guildName: message.guild.name,
        expiresAt,
      };
      addTimedMute(timedMute);
      scheduleTimedMute(message.client, timedMute);

      const dmAdditionalInfo = additionalInfo ?? getAdditionalInfo(guildId, "mute");

      await sendDmNotification(target, {
        action: "Muted",
        guildName: message.guild.name,
        reason,
        caseId: infraction.id,
        duration,
        expiresAt,
        additionalInfo: dmAdditionalInfo,
      });

      if (!silent) await message.channel.send(`Muted ${target}.\n(${infraction.id})`);
      await message.delete().catch(() => {});

      await sendModLog(message.client, guildId, {
        action: `Member Muted (${duration})`,
        executor: { tag: message.author.tag, id: message.author.id },
        target: { tag: target.tag, id: target.id },
        channel: {
          name: (message.channel as any).name ?? "unknown",
          id: message.channel.id,
        },
        reason,
        color: 0xf39c12,
        caseId: infraction.id,
      });

      logger.info({ targetId: target.id, seconds, reason, caseId: infraction.id }, "User muted");

      await promptAltPunishment(message, target.id, "muted", async (altId) => {
        const altMember = await message.guild!.members.fetch(altId).catch(() => null);
        if (!altMember) { await message.channel.send(`⚠️ Alt <@${altId}> is not in this server, skipping.`); return; }
        if (!altMember.moderatable) { await message.channel.send(`⚠️ Cannot mute alt <@${altId}> — insufficient permissions.`); return; }
        await altMember.timeout(seconds * 1000, `Alt of muted user ${target.tag} | Muted by ${message.author.tag}`);
        await message.channel.send(`Also muted alt <@${altId}>.`);
      });
    } catch (err) {
      logger.error({ err }, "Failed to mute user");
      await message.reply("❌ Failed to mute the user.");
    }
  },
};
