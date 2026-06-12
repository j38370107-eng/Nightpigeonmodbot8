import { Message, PermissionFlagsBits, GuildMember } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { addInfraction, getInfractions } from "../store/infractions";
import { sendModLog } from "../lib/modlog";
import { sendDmNotification } from "../lib/dmNotify";
import { getWarnExpiry } from "../store/expiry";
import { resolveTarget, getArgs } from "../lib/resolveUser";
import { getExecutorMember, isHierarchyBlocked } from "../lib/hierarchy";
import { getAdditionalInfo } from "../store/additionalInfo";
import { getMuteConfig } from "../store/muteConfig";
import { dbGet } from "../store/db";
import { promptAltPunishment } from "../lib/altPrompt";
import { getGuildSetting } from "../store/settings";

function parseDuration(str: string): number {
  const match = str?.match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return 3_600_000;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const units: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  return n * (units[unit] ?? 3_600_000);
}

function parseAdditionalInfo(text: string): { reason: string; additionalInfo?: string } {
  const pipeIdx = text.indexOf("|");
  if (pipeIdx === -1) return { reason: text.trim() };
  return {
    reason: text.slice(0, pipeIdx).trim(),
    additionalInfo: text.slice(pipeIdx + 1).trim() || undefined,
  };
}

const PAST_TENSE: Record<string, string> = {
  kick: "Kicked",
  ban: "Banned",
  mute: "Muted",
};

export const warnCommand: Command = {
  name: "warn",
  aliases: [],
  description: "Issue a warning to a member",
  usage: "<@user | userID> [-s] <reason> [| additional info]",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    // -s / --silent: suppress the public channel confirmation message
    const silent = args.includes("-s") || args.includes("--silent");
    const filteredArgs = args.filter((a) => a !== "-s" && a !== "--silent");

    const resolved = await resolveTarget(message, filteredArgs);
    if (!resolved) return message.reply(usageErr(message, warnCommand, "Mention a user or provide a valid user ID"));

    const { user: target, member } = resolved;
    const rawText = getArgs(message, filteredArgs).join(" ");
    const { reason, additionalInfo } = parseAdditionalInfo(rawText);

    if (!reason) return message.reply(usageErr(message, warnCommand, "Provide a reason for the warning"));
    if (!member) return message.reply("❌ That user is not in this server.");

    const executorMember = await getExecutorMember(message);
    if (executorMember && isHierarchyBlocked(executorMember, member)) {
      return message.reply("❌ You cannot warn someone with an equal or higher role than you.");
    }

    // Protected role check — read from DB so dashboard changes apply immediately
    const protectedRoles = await dbGet<string[]>("protectedRoles", message.guild.id).catch(() => null) ?? [];
    const memberRoleIds = member.roles.cache.map((r) => r.id);
    if (protectedRoles.length > 0 && protectedRoles.some((r) => memberRoleIds.includes(r))) {
      return message.reply("❌ That member has a **protected role** and cannot be warned.");
    }

    const warnExpiry = getWarnExpiry(message.guild.id);
    const expiresAt = warnExpiry === 0 ? undefined : Date.now() + warnExpiry;

    const infraction = addInfraction(message.guild.id, target.id, {
      type: "Warn",
      reason,
      moderatorId: message.author.id,
      moderatorTag: message.author.tag,
      expiresAt,
      automod: false,
    });

    // Count only active, manually-issued warns (automod has its own separate escalation)
    const now = Date.now();
    const totalManualWarns = getInfractions(message.guild.id, target.id).filter(
      (i) => i.type === "Warn" && i.automod === false && (!i.expiresAt || i.expiresAt > now)
    ).length;

    const dmAdditionalInfo = additionalInfo ?? getAdditionalInfo(message.guild.id, "warn");

    await sendDmNotification(target, {
      action: "Warned",
      guildName: message.guild.name,
      reason,
      caseId: infraction.id,
      expiresAt,
      additionalInfo: dmAdditionalInfo,
    });

    if (!silent) await message.channel.send(`Warned ${target}.\n(${infraction.id})`);
    await message.delete().catch(() => {});

    await sendModLog(message.client, message.guild.id, {
      action: `Member Warned (Warn #${totalManualWarns})`,
      executor: { tag: message.author.tag, id: message.author.id },
      target: { tag: target.tag, id: target.id },
      channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
      reason,
      color: 0xf1c40f,
      caseId: infraction.id,
    });

    logger.info({ targetId: target.id, reason, caseId: infraction.id, totalManualWarns }, "User warned");

    await promptAltPunishment(message, target.id, "warned", async (altId) => {
      addInfraction(message.guild!.id, altId, {
        type: "Warn",
        reason: `Alt of warned user ${target.tag}: ${reason}`,
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
        automod: false,
      });
      await message.channel.send(`Also warned alt <@${altId}>.`);
    });

    // ── Manual warn escalation ────────────────────────────────────────────────
    // Use the in-memory settings cache (loaded on startup, refreshed every 5s)
    // instead of a raw DB call that can fail silently.
    const warnEscalation = getGuildSetting(message.guild.id, "warnEscalation");
    const escalationSteps: Array<{ strikes: number; action: string; duration?: string }> =
      warnEscalation?.steps ?? [];

    // Use Number() coercion so string values stored from old data still match
    const matchStep = escalationSteps.find((s) => Number(s.strikes) === totalManualWarns);

    if (matchStep && matchStep.action !== "warn") {
      const escReason = `Auto-escalation: reached ${totalManualWarns} manual warning${totalManualWarns === 1 ? "" : "s"}`;
      try {
        if (matchStep.action === "kick") {
          await (member as GuildMember).kick(escReason);
        } else if (matchStep.action === "ban") {
          await (member as GuildMember).ban({ reason: escReason, deleteMessageSeconds: 604800 });
        } else if (matchStep.action === "mute") {
          const durationMs = parseDuration(matchStep.duration ?? "1h");
          const muteConfig = getMuteConfig(message.guild.id);
          if (muteConfig.mode === "role" && muteConfig.muteRoleId) {
            await (member as GuildMember).roles.add(muteConfig.muteRoleId, escReason);
          } else {
            await (member as GuildMember).timeout(Math.min(durationMs, 28 * 86_400_000), escReason);
          }
        }

        const actionLabel = matchStep.action.charAt(0).toUpperCase() + matchStep.action.slice(1);
        const actionPast = PAST_TENSE[matchStep.action] ?? actionLabel;
        await message.channel.send(
          `⚠️ **Escalation triggered** — ${target} has reached **${totalManualWarns} manual warning${totalManualWarns === 1 ? "" : "s"}** and has been **${actionPast}**.`
        );

        await sendModLog(message.client, message.guild.id, {
          action: `⚠️ Escalation: ${actionPast} (${totalManualWarns} manual warning${totalManualWarns === 1 ? "" : "s"})`,
          executor: { tag: message.client.user!.tag, id: message.client.user!.id },
          target: { tag: target.tag, id: target.id },
          reason: escReason,
          color: 0xff6b6b,
        });

        logger.info({ targetId: target.id, action: matchStep.action, totalManualWarns }, "Manual warn escalation triggered");
      } catch (err) {
        logger.error({ err, targetId: target.id, action: matchStep.action }, "Warn escalation action failed");
        await message.channel.send(`⚠️ Escalation to **${matchStep.action}** failed — check my permissions.`).catch(() => {});
      }
    }
  },
};
