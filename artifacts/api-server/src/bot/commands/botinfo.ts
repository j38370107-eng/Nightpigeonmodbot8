import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, version as djsVersion } from "discord.js";
import type { Command } from "./types";

const INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1507550967275458660&permissions=6293600228863223&integration_type=0&scope=bot";
const SUPPORT_URL = "https://discord.gg/fV6vfJ3c4B";

export const botinfoCommand: Command = {
  name: "botinfo",
  aliases: ["bot", "about"],
  description: "Show information about the bot",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    const client = message.client;
    const uptime = process.uptime();

    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const uptimeStr = [
      days > 0 ? `${days}d` : null,
      hours > 0 ? `${hours}h` : null,
      minutes > 0 ? `${minutes}m` : null,
      `${seconds}s`,
    ]
      .filter(Boolean)
      .join(" ");

    const guildCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    const ping = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({
        name: client.user?.username ?? "Bot",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setThumbnail(client.user?.displayAvatarURL() ?? null)
      .addFields(
        { name: "⏱️ Uptime", value: uptimeStr, inline: true },
        { name: "🏓 Ping", value: `${ping}ms`, inline: true },
        { name: "🌐 Servers", value: `${guildCount}`, inline: true },
        { name: "👥 Users", value: userCount.toLocaleString(), inline: true },
        { name: "📦 Discord.js", value: `v${djsVersion}`, inline: true },
        { name: "🟢 Node.js", value: process.version, inline: true },
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Invite Link")
        .setStyle(ButtonStyle.Link)
        .setURL(INVITE_URL),
      new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL(SUPPORT_URL),
    );

    await message.reply({ embeds: [embed], components: [row] });
  },
};
