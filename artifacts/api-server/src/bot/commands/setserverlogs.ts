import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";

export const setServerLogsCommand: Command = {
  name: "setserverlogs",
  aliases: ["serverlogs", "serverlogchannel"],
  description: "Configure server logs via the dashboard",
  usage: "",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, _args: string[]) {
    if (!message.guild) return;

    const baseUrl =
      process.env["DASHBOARD_URL"] ?? "https://utilitypulse-dashboard-pzu9.onrender.com";
    const dashboardUrl = `${baseUrl}/dashboard/${message.guild.id}`;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📋 Server Logs — Use the Dashboard")
      .setDescription(
        `Server log settings are now managed through the **web dashboard**.\n\n[**Open Dashboard →**](${dashboardUrl})\n\`${dashboardUrl}\``,
      )
      .addFields({
        name: "What you can configure there",
        value: [
          "📝 Log channel selection",
          "📢 Message edits & deletes",
          "👤 Member joins & leaves",
          "🔨 Bans, kicks & unbans",
          "🏷️ Nickname & role changes",
          "📢 Channels created, deleted & updated",
          "🎭 Roles created, deleted & updated",
          "🔊 Voice channel joins, leaves & moves",
        ].join("\n"),
      })
      .setFooter({ text: "You must be a server admin to access the dashboard" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
