import { Message, EmbedBuilder } from "discord.js";
import type { Command } from "./types";

export const dashboardCommand: Command = {
  name: "dashboard",
  aliases: ["dash", "panel"],
  description: "Get a link to the web dashboard for this server",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message, _args: string[]) {
    if (!message.guild) return;
    const baseUrl = process.env["DASHBOARD_URL"] ?? "https://utilitypulse-dashboard-pzu9.onrender.com";
    const guildUrl = `${baseUrl}/dashboard/${message.guild.id}`;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🖥️ Server Dashboard")
      .setDescription(`[**Open Dashboard →**](${guildUrl})\n\`${guildUrl}\``)
      .setFooter({ text: "You must be a server admin to log in" });

    return message.reply({ embeds: [embed] });
  },
};
