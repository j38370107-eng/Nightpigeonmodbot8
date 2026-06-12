import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { setLogChannel } from "../store/modlog";

export const setLogChannelCommand: Command = {
  name: "setmodlogs",
  aliases: ["setlogchannel", "setlogs", "logchannel"],
  description: "Set the channel where moderation logs are posted",
  usage: "<#channel>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const channel =
      message.mentions.channels.first() ??
      (args[0] ? message.guild.channels.cache.get(args[0]) : null);

    if (!channel || !("send" in channel)) {
      return message.reply(usageErr(message, setLogChannelCommand, "Mention a valid text channel"));
    }

    setLogChannel(message.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Mod Log Channel Set")
      .setDescription(`Moderation logs will now be posted in <#${channel.id}>.`)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
