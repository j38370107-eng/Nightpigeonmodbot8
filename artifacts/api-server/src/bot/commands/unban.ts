import { Message, PermissionFlagsBits } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";
import { addInfraction } from "../store/infractions";
import { resolveTarget, getArgs } from "../lib/resolveUser";

export const unbanCommand: Command = {
  name: "unban",
  aliases: [],
  description: "Unban a user from the server",
  usage: "<@user | userID> [reason]",
  requiredPermissions: [PermissionFlagsBits.BanMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const resolved = await resolveTarget(message, args);
    if (!resolved) return message.reply(usageErr(message, unbanCommand, "Mention a user or provide a valid user ID"));

    const { user } = resolved;
    const reason = getArgs(message, args).join(" ") || "No reason provided";

    const bans = await message.guild.bans.fetch().catch(() => null);
    if (!bans?.has(user.id)) {
      return message.reply(`❌ **${user.tag}** is not banned from this server.`);
    }

    try {
      await message.guild.members.unban(user.id, `${reason} | Unbanned by ${message.author.tag}`);

      const infraction = addInfraction(message.guild.id, user.id, {
        type: "Unban",
        reason,
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
      });

      await message.channel.send(`Unbanned ${user}.\n(${infraction.id})`);
      await message.delete().catch(() => {});

      await sendModLog(message.client, message.guild.id, {
        action: "Member Unbanned",
        executor: { tag: message.author.tag, id: message.author.id },
        target: { tag: user.tag, id: user.id },
        channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
        reason,
        color: 0x2ecc71,
        caseId: infraction.id,
      });

      logger.info({ targetId: user.id, reason, caseId: infraction.id }, "User unbanned");
    } catch (err) {
      logger.error({ err }, "Failed to unban user");
      await message.reply("❌ Failed to unban the user.");
    }
  },
};
