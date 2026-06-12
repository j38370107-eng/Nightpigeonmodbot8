import { Message, PermissionFlagsBits } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";
import { resolveTarget, getArgs } from "../lib/resolveUser";
import { getExecutorMember, isHierarchyBlocked } from "../lib/hierarchy";

export const nickCommand: Command = {
  name: "nick",
  aliases: ["nickname"],
  description: "Set or clear a member's nickname",
  usage: "<@user | userID> [new nickname]",
  requiredPermissions: [PermissionFlagsBits.ManageNicknames],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const resolved = await resolveTarget(message, args);
    if (!resolved) return message.reply(usageErr(message, nickCommand, "Mention a user or provide a valid user ID"));

    const { user: target, member } = resolved;
    if (!member) return message.reply("❌ That user is not in this server.");
    if (!member.manageable) {
      return message.reply("❌ I cannot manage this user's nickname — they may have a higher role than me.");
    }

    const executorMember = await getExecutorMember(message);
    if (executorMember && isHierarchyBlocked(executorMember, member)) {
      return message.reply("❌ You cannot change the nickname of someone with an equal or higher role than you.");
    }

    const nickname = getArgs(message, args).join(" ").trim() || null;

    try {
      const oldNick = member.nickname ?? target.username;
      await member.setNickname(nickname, `Changed by ${message.author.tag}`);

      const display = nickname ?? "*cleared*";
      await message.channel.send(`Updated nickname for <@${target.id}>: **${display}**`);
      await message.delete().catch(() => {});

      await sendModLog(message.client, message.guild.id, {
        action: nickname ? "Nickname Changed" : "Nickname Cleared",
        executor: { tag: message.author.tag, id: message.author.id },
        target: { tag: target.tag, id: target.id },
        reason: nickname ? `${oldNick} → ${nickname}` : `Cleared (was: ${oldNick})`,
        color: 0x9b59b6,
      });

      logger.info({ targetId: target.id, nickname }, "Nickname changed");
    } catch (err) {
      logger.error({ err }, "Failed to change nickname");
      await message.reply("❌ Failed to change the nickname.");
    }
  },
};
