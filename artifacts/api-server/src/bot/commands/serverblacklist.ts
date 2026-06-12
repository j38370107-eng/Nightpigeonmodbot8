import { Message, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  OWNER_ID,
  blacklistGuild,
  unblacklistGuild,
  getBlacklistedGuilds,
  isGuildBlacklisted,
} from "../store/ownerBlacklists";

export const serverBlacklistCommand: Command = {
  name: "serverblacklist",
  aliases: ["sbl", "guildblacklist"],
  description: "[Owner] Blacklist or unblacklist a server from using the bot",
  usage: "add <guildID> | remove <guildID> | list",
  ownerOnly: true,

  async execute(message: Message, args: string[]) {
    if (message.author.id !== OWNER_ID) return;

    const sub = args[0]?.toLowerCase();
    const guildId = args[1];

    if (sub === "add") {
      if (!guildId) return message.reply(usageErr(message, serverBlacklistCommand, "Provide a server ID"));
      const added = blacklistGuild(guildId);
      const name = message.client.guilds.cache.get(guildId)?.name ?? guildId;
      return message.reply(
        added
          ? `✅ Server **${name}** (\`${guildId}\`) has been blacklisted.`
          : `ℹ️ Server \`${guildId}\` is already blacklisted.`,
      );
    }

    if (sub === "remove" || sub === "del") {
      if (!guildId) return message.reply(usageErr(message, serverBlacklistCommand, "Provide a server ID"));
      const removed = unblacklistGuild(guildId);
      const name = message.client.guilds.cache.get(guildId)?.name ?? guildId;
      return message.reply(
        removed
          ? `✅ Server **${name}** (\`${guildId}\`) has been unblacklisted.`
          : `❌ Server \`${guildId}\` is not blacklisted.`,
      );
    }

    if (sub === "list" || !sub) {
      const guilds = getBlacklistedGuilds();
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🚫 Blacklisted Servers")
        .setDescription(
          guilds.length
            ? guilds
                .map((id) => {
                  const name = message.client.guilds.cache.get(id)?.name;
                  return name ? `• **${name}** (\`${id}\`)` : `• \`${id}\``;
                })
                .join("\n")
            : "No servers blacklisted.",
        )
        .setFooter({ text: `${guilds.length} server${guilds.length === 1 ? "" : "s"} blacklisted` })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    return message.reply(usageErr(message, serverBlacklistCommand, "Invalid subcommand — use add, remove, or list"));
  },
};
