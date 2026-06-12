import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";
import { addInfraction } from "../store/infractions";
import { sendDmNotification } from "../lib/dmNotify";
import { resolveTarget, getArgs } from "../lib/resolveUser";
import { getExecutorMember, isHierarchyBlocked } from "../lib/hierarchy";
import { getAdditionalInfo } from "../store/additionalInfo";
import { promptAltPunishment } from "../lib/altPrompt";

export const kickCommand: Command = {
  name: "kick",
  aliases: [],
  description: "Kick a member from the server",
  usage: "<@user | userID> [-s] [reason]",
  requiredPermissions: [PermissionFlagsBits.KickMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const silent = args.includes("-s") || args.includes("--silent");
    const filteredArgs = args.filter((a) => a !== "-s" && a !== "--silent");

    const resolved = await resolveTarget(message, filteredArgs);
    if (!resolved) return message.reply(usageErr(message, kickCommand, "Mention a user or provide a valid user ID"));

    const { user: target, member } = resolved;
    const reason = getArgs(message, filteredArgs).join(" ") || "No reason provided";

    if (!member) return message.reply("❌ That user is not in this server.");
    if (!member.kickable) {
      return message.reply("❌ I cannot kick this user — they may have a higher role than me.");
    }

    const executorMember = await getExecutorMember(message);
    if (executorMember && isHierarchyBlocked(executorMember, member)) {
      return message.reply("❌ You cannot kick someone with an equal or higher role than you.");
    }

    const dmAdditionalInfo = getAdditionalInfo(message.guild.id, "kick");

    try {
      const infraction = addInfraction(message.guild.id, target.id, {
        type: "Kick",
        reason,
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
      });

      await sendDmNotification(target, {
        action: "Kicked",
        guildName: message.guild.name,
        reason,
        caseId: infraction.id,
        additionalInfo: dmAdditionalInfo,
      });

      await member.kick(`${reason} | Kicked by ${message.author.tag}`);

      if (!silent) await message.channel.send(`Kicked ${target}.\n(${infraction.id})`);
      await message.delete().catch(() => {});

      await sendModLog(message.client, message.guild.id, {
        action: "Member Kicked",
        executor: { tag: message.author.tag, id: message.author.id },
        target: { tag: target.tag, id: target.id },
        channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
        reason,
        color: 0xe67e22,
        caseId: infraction.id,
      });

      logger.info({ targetId: target.id, reason, caseId: infraction.id }, "User kicked");

      await promptAltPunishment(message, target.id, "kicked", async (altId) => {
        const altMember = await message.guild!.members.fetch(altId).catch(() => null);
        if (!altMember) {
          await message.channel.send(`⚠️ Alt <@${altId}> is not in this server, skipping.`);
          return;
        }
        await altMember.kick(`Alt of kicked user ${target.tag} | Kicked by ${message.author.tag}`);
        await message.channel.send(`Also kicked alt <@${altId}>.`);
      });
    } catch (err) {
      logger.error({ err }, "Failed to kick user");
      await message.reply("❌ Failed to kick the user.");
    }
  },
};
