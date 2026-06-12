import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { resolveTarget } from "../lib/resolveUser";
import { getInfractions } from "../store/infractions";

export const baninfoCommand: Command = {
  name: "baninfo",
  aliases: ["binfo"],
  description: "Show ban information for a banned or previously banned user",
  usage: "<@user | userID>",
  requiredPermissions: [PermissionFlagsBits.BanMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const resolved = await resolveTarget(message, args);
    if (!resolved) return message.reply(usageErr(message, baninfoCommand, "Mention a user or provide a valid user ID"));

    const { user } = resolved;

    const ban = await message.guild.bans.fetch(user.id).catch(() => null);
    const infractions = getInfractions(message.guild.id, user.id);
    const banInfraction = infractions.filter((i) => i.type === "Ban").at(-1);

    if (!ban && !banInfraction) {
      return message.reply(`❌ No ban record found for **${user.tag}**.`);
    }

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`Ban Info — ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "User", value: `<@${user.id}> \`${user.id}\``, inline: false },
        {
          name: "Status",
          value: ban ? "🔴 Currently Banned" : "🟢 Not Currently Banned",
          inline: true,
        },
      );

    if (banInfraction) {
      embed.addFields(
        { name: "Case ID", value: `\`${banInfraction.id}\``, inline: true },
        { name: "Reason", value: banInfraction.reason, inline: false },
        {
          name: "Banned By",
          value: `<@${banInfraction.moderatorId}> (${banInfraction.moderatorTag})`,
          inline: true,
        },
        {
          name: "Banned At",
          value: `<t:${Math.floor(banInfraction.timestamp / 1000)}:F>`,
          inline: true,
        },
      );
      if (banInfraction.expiresAt) {
        embed.addFields({
          name: banInfraction.expiresAt > Date.now() ? "Expires" : "Expired",
          value: `<t:${Math.floor(banInfraction.expiresAt / 1000)}:F>`,
          inline: true,
        });
      }
      if (banInfraction.automod) {
        embed.addFields({ name: "Source", value: "🤖 AutoMod", inline: true });
      }
    } else if (ban) {
      embed.addFields({
        name: "Reason",
        value: ban.reason ?? "No reason provided",
        inline: false,
      });
    }

    embed.setTimestamp();
    await message.reply({ embeds: [embed] });
  },
};
