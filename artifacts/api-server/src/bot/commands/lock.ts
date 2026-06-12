import { Message, PermissionFlagsBits, TextChannel, EmbedBuilder } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { sendModLog } from "../lib/modlog";

export const lockCommand: Command = {
  name: "lock",
  aliases: [],
  description: "Lock the current channel",
  usage: "[reason]",
  requiredPermissions: [PermissionFlagsBits.ManageRoles],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const channel = message.channel as TextChannel;
    if (!("permissionOverwrites" in channel)) {
      return message.reply("❌ This command can only be used in a text channel.");
    }

    const reason = args.join(" ") || "No reason provided";

    try {
      await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false,
      });

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🔒 Channel Locked")
        .addFields(
          { name: "Moderator", value: message.author.tag, inline: true },
          { name: "Reason", value: reason }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      await sendModLog(message.client, message.guild.id, {
        action: "Channel Locked",
        executor: { tag: message.author.tag, id: message.author.id },
        channel: { name: channel.name, id: channel.id },
        reason,
        color: 0xe74c3c,
      });

      logger.info({ channelId: channel.id, reason }, "Channel locked");
    } catch (err) {
      logger.error({ err }, "Failed to lock channel");
      await message.reply("❌ Failed to lock the channel.");
    }
  },
};
