import { Message, EmbedBuilder, ChannelType } from "discord.js";
import type { Command } from "./types";

const VERIFICATION: Record<number, string> = {
  0: "None",
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Very High",
};

export const serverinfoCommand: Command = {
  name: "serverinfo",
  aliases: ["si", "guildinfo"],
  description: "Show information about this server",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    if (!message.guild) return;

    const guild = message.guild;
    await guild.fetch();

    const owner = await guild.fetchOwner().catch(() => null);
    const createdAt = Math.floor(guild.createdTimestamp / 1000);

    const channels = guild.channels.cache;
    const textChannels = channels.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
    const categories = channels.filter((c) => c.type === ChannelType.GuildCategory).size;

    const totalMembers = guild.memberCount;
    const roles = guild.roles.cache.size - 1; // exclude @everyone
    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount ?? 0;
    const verificationLevel = VERIFICATION[guild.verificationLevel] ?? "Unknown";

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
      .addFields(
        {
          name: "Owner",
          value: owner ? `<@${owner.id}>` : "Unknown",
          inline: true,
        },
        {
          name: "Created",
          value: `<t:${createdAt}:R>`,
          inline: true,
        },
        {
          name: "Server ID",
          value: guild.id,
          inline: true,
        },
        {
          name: "Members",
          value: `${totalMembers.toLocaleString()}`,
          inline: true,
        },
        {
          name: "Roles",
          value: `${roles}`,
          inline: true,
        },
        {
          name: "Verification",
          value: verificationLevel,
          inline: true,
        },
        {
          name: "Channels",
          value: `💬 ${textChannels} text · 🔊 ${voiceChannels} voice · 📁 ${categories} categories`,
          inline: false,
        },
        {
          name: "Boosts",
          value: `Level ${boostLevel} · ${boostCount} boost${boostCount === 1 ? "" : "s"}`,
          inline: true,
        },
      )
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }) ?? null);
    }

    await message.reply({ embeds: [embed] });
  },
};
