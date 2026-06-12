import { Message, PermissionFlagsBits } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";
import { addInfraction } from "../store/infractions";
import { sendDmNotification } from "../lib/dmNotify";
import { resolveTarget, getArgs } from "../lib/resolveUser";
import { getExecutorMember, isHierarchyBlocked } from "../lib/hierarchy";
import { markManualUnmute } from "../store/manualUnmutes";
import { removeTimedMute, getTimedMute } from "../store/timedMutes";
import { getMuteConfig } from "../store/muteConfig";

export const unmuteCommand: Command = {
  name: "unmute",
  aliases: ["untimeout"],
  description: "Remove a mute from a member (timeout or mute role)",
  usage: "<@user | userID> [reason]",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const resolved = await resolveTarget(message, args);
    if (!resolved) return message.reply(usageErr(message, unmuteCommand, "Mention a user or provide a valid user ID"));

    const { user: target, member } = resolved;
    const reason = getArgs(message, args).join(" ") || "No reason provided";

    if (!member) return message.reply("❌ That user is not in this server.");

    const executorMember = await getExecutorMember(message);
    if (executorMember && isHierarchyBlocked(executorMember, member)) {
      return message.reply("❌ You cannot unmute someone with an equal or higher role than you.");
    }

    const guildId = message.guild.id;
    const muteCfg = getMuteConfig(guildId);

    try {
      // ── Role mode ─────────────────────────────────────────────────────────
      if (muteCfg.mode === "role") {
        if (!muteCfg.muteRoleId) {
          return message.reply("❌ No mute role configured. Check `>muteconfig`.");
        }
        if (!member.roles.cache.has(muteCfg.muteRoleId)) {
          return message.reply("ℹ️ That user does not have the mute role and is not currently muted.");
        }

        // Retrieve any saved stripped roles before clearing the timed mute
        const timedMute = getTimedMute(guildId, target.id);
        removeTimedMute(guildId, target.id);

        if (timedMute?.strippedRoles && timedMute.strippedRoles.length > 0) {
          // Restore original roles (filter out any deleted ones)
          const valid = timedMute.strippedRoles.filter((id) =>
            message.guild!.roles.cache.has(id),
          );
          await member.roles.set(valid, `${reason} | Unmuted by ${message.author.tag}`);
        } else {
          await member.roles.remove(
            muteCfg.muteRoleId,
            `${reason} | Unmuted by ${message.author.tag}`,
          );
        }
      } else {
        // ── Timeout mode ───────────────────────────────────────────────────
        if (!member.isCommunicationDisabled()) {
          return message.reply("ℹ️ That user is not currently muted.");
        }
        markManualUnmute(guildId, target.id);
        removeTimedMute(guildId, target.id);
        await member.timeout(null, `${reason} | Unmuted by ${message.author.tag}`);
      }

      const infraction = addInfraction(guildId, target.id, {
        type: "Unmute",
        reason,
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
      });

      await sendDmNotification(target, {
        action: "Unmuted",
        guildName: message.guild.name,
        reason,
        caseId: infraction.id,
      });

      await message.channel.send(`Unmuted ${target}.\n(${infraction.id})`);
      await message.delete().catch(() => {});

      await sendModLog(message.client, guildId, {
        action: "Member Unmuted",
        executor: { tag: message.author.tag, id: message.author.id },
        target: { tag: target.tag, id: target.id },
        channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
        reason,
        color: 0x2ecc71,
        caseId: infraction.id,
      });

      logger.info({ targetId: target.id, reason, caseId: infraction.id }, "User unmuted");
    } catch (err) {
      logger.error({ err }, "Failed to unmute user");
      await message.reply("❌ Failed to unmute the user.");
    }
  },
};
