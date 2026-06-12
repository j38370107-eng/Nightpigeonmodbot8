import { Message, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { appBlacklistUser, appUnblacklistUser, isAppBlacklisted } from "../store/applicationForms";

export const appBlacklistCommand: Command = {
  name: "ablacklist",
  aliases: ["appblacklist", "ablist"],
  description: "Block a user from submitting any application forms",
  usage: "@user [reason]",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const target = message.mentions.users.first() ?? (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!target) return message.reply(usageErr(message, appBlacklistCommand, "Mention a user or provide their ID"));
    if (target.id === message.author.id) return message.reply("❌ You cannot blacklist yourself.");

    if (isAppBlacklisted(message.guild.id, target.id)) {
      return message.reply(`⚠️ <@${target.id}> is already blocked from applications.`);
    }

    const reason = args.slice(message.mentions.users.size > 0 ? 1 : 1).join(" ") || "No reason provided";
    appBlacklistUser(message.guild.id, target.id);

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("📋 Application Blocked")
      .setDescription(`<@${target.id}> has been blocked from submitting applications.`)
      .addFields(
        { name: "User", value: `${target.username} (${target.id})`, inline: true },
        { name: "Moderator", value: `${message.author.username}`, inline: true },
        { name: "Reason", value: reason, inline: false },
      )
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
  },
};

export const appUnblacklistCommand: Command = {
  name: "aunblacklist",
  aliases: ["appunblacklist", "abunlist"],
  description: "Unblock a user from submitting application forms",
  usage: "@user",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const target = message.mentions.users.first() ?? (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!target) return message.reply(usageErr(message, appUnblacklistCommand, "Mention a user or provide their ID"));

    const removed = appUnblacklistUser(message.guild.id, target.id);
    if (!removed) {
      return message.reply(`❌ <@${target.id}> is not blocked from applications.`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("📋 Application Unblocked")
      .setDescription(`<@${target.id}> can now submit applications again.`)
      .addFields(
        { name: "User", value: `${target.username} (${target.id})`, inline: true },
        { name: "Moderator", value: `${message.author.username}`, inline: true },
      )
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
  },
};
