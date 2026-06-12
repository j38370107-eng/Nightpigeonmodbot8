import { Message, PermissionFlagsBits, TextChannel, EmbedBuilder } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { sendModLog } from "../lib/modlog";

export const unlockCommand: Command = {
  name: "unlock",
  aliases: [],
  description: "Unlock the current channel",
  usage: "",
  requiredPermissions: [PermissionFlagsBits.ManageRoles],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const channel = message.channel as TextChannel;
    if (!("permissionOverwrites" in channel)) {
      return message.reply("❌ This command can only be used in a text channel.");
    }

    try {
      await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null,
      });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🔓 Channel Unlocked")
        .addFields({ name: "Moderator", value: message.author.tag, inline: true })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      await sendModLog(message.client, message.guild.id, {
        action: "Channel Unlocked",
        executor: { tag: message.author.tag, id: message.author.id },
        channel: { name: channel.name, id: channel.id },
        color: 0x2ecc71,
      });

      logger.info({ channelId: channel.id }, "Channel unlocked");
    } catch (err) {
      logger.error({ err }, "Failed to unlock channel");
      await message.reply("❌ Failed to unlock the channel.");
    }
  },
};
