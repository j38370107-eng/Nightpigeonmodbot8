import { Message, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  OWNER_ID,
  blacklistUser,
  unblacklistUser,
  getBlacklistedUsers,
} from "../store/ownerBlacklists";

export const userBlacklistCommand: Command = {
  name: "userblacklist",
  aliases: ["ubl", "globalban"],
  description: "[Owner] Blacklist or unblacklist a user from using the bot globally",
  usage: "add <userID> | remove <userID> | list",
  ownerOnly: true,

  async execute(message: Message, args: string[]) {
    if (message.author.id !== OWNER_ID) return;

    const sub = args[0]?.toLowerCase();
    const userId = args[1];

    if (sub === "add") {
      if (!userId) return message.reply(usageErr(message, userBlacklistCommand, "Provide a user ID"));
      if (userId === OWNER_ID) return message.reply("❌ You cannot blacklist yourself.");
      const added = blacklistUser(userId);
      const user = await message.client.users.fetch(userId).catch(() => null);
      const name = user?.tag ?? userId;
      return message.reply(
        added
          ? `✅ User **${name}** (\`${userId}\`) has been globally blacklisted.`
          : `ℹ️ User \`${userId}\` is already blacklisted.`,
      );
    }

    if (sub === "remove" || sub === "del") {
      if (!userId) return message.reply(usageErr(message, userBlacklistCommand, "Provide a user ID"));
      const removed = unblacklistUser(userId);
      const user = await message.client.users.fetch(userId).catch(() => null);
      const name = user?.tag ?? userId;
      return message.reply(
        removed
          ? `✅ User **${name}** (\`${userId}\`) has been unblacklisted.`
          : `❌ User \`${userId}\` is not blacklisted.`,
      );
    }

    if (sub === "list" || !sub) {
      const users = getBlacklistedUsers();
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🚫 Globally Blacklisted Users")
        .setDescription(
          users.length
            ? users.map((id) => `• <@${id}> (\`${id}\`)`).join("\n")
            : "No users blacklisted.",
        )
        .setFooter({ text: `${users.length} user${users.length === 1 ? "" : "s"} blacklisted` })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    return message.reply(usageErr(message, userBlacklistCommand, "Invalid subcommand — use add, remove, or list"));
  },
};
