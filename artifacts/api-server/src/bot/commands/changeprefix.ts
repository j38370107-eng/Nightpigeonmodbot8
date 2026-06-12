import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { setPrefix } from "../store/prefixes";

export const changePrefixCommand: Command = {
  name: "changeprefix",
  aliases: ["setprefix", "prefix"],
  description: "Change the bot's command prefix for this server",
  usage: "<new prefix>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const newPrefix = args[0];
    if (!newPrefix) {
      return message.reply(usageErr(message, changePrefixCommand, "Provide a new prefix"));
    }

    if (newPrefix.length > 5) {
      return message.reply(usageErr(message, changePrefixCommand, "Prefix must be 5 characters or fewer"));
    }

    setPrefix(message.guild.id, newPrefix);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("✅ Prefix Updated")
      .setDescription(`The command prefix for this server is now \`${newPrefix}\`\nExample: \`${newPrefix}ban\``)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
