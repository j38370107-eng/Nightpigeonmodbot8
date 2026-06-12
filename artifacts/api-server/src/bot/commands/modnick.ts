import { Message, PermissionFlagsBits } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";
import { resolveTarget } from "../lib/resolveUser";
import { getExecutorMember, isHierarchyBlocked } from "../lib/hierarchy";

const DISCORD_NICK_LIMIT = 32;
const MOD_NICK_PREFIX = "Moderated Nickname ";

export const modnickCommand: Command = {
  name: "modnick",
  aliases: ["mn", "moderatenick"],
  description: "Replace a member's nickname with a moderated one",
  usage: "<@user | userID>",
  requiredPermissions: [PermissionFlagsBits.ManageNicknames],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const resolved = await resolveTarget(message, args);
    if (!resolved) return message.reply(usageErr(message, modnickCommand, "Mention a user or provide a valid user ID"));

    const { user: target, member } = resolved;

    if (!member) return message.reply("❌ That user is not in this server.");
    if (!member.manageable) {
      return message.reply("❌ I cannot manage this user's nickname — they may have a higher role than me.");
    }

    const executorMember = await getExecutorMember(message);
    if (executorMember && isHierarchyBlocked(executorMember, member)) {
      return message.reply("❌ You cannot moderate the nickname of someone with an equal or higher role than you.");
    }

    // Build nickname: "Moderated Nickname <userId>" trimmed to Discord's 32-char limit
    const newNick = (MOD_NICK_PREFIX + target.id).slice(0, DISCORD_NICK_LIMIT);

    try {
      await member.setNickname(newNick, `Moderated by ${message.author.tag}`);

      await message.channel.send(
        `Changed nickname to **${newNick}**.`
      );
      await message.delete().catch(() => {});

      await sendModLog(message.client, message.guild.id, {
        action: "Nickname Moderated",
        executor: { tag: message.author.tag, id: message.author.id },
        target: { tag: target.tag, id: target.id },
        channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
        reason: `Nickname changed to: ${newNick}`,
        color: 0x9b59b6,
      });

      logger.info({ targetId: target.id, newNick }, "Nickname moderated");
    } catch (err) {
      logger.error({ err }, "Failed to moderate nickname");
      await message.reply("❌ Failed to change the nickname.");
    }
  },
};
