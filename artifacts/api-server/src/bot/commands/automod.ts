import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";

const DASHBOARD_URL = process.env["DASHBOARD_URL"] ?? "https://utilitypulse-dashboard-pzu9.onrender.com";

export const automodCommand: Command = {
  name: "automod",
  aliases: ["am"],
  description: "Configure AutoMod via the dashboard",
  usage: "",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message) {
    if (!message.guild) return;

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("AutoMod Configuration")
          .setDescription(
            `Configure AutoMod rules and settings for **${message.guild.name}** via the dashboard.\n\n` +
            `[**Open Dashboard →**](${DASHBOARD_URL})`
          )
          .setFooter({ text: "AutoMod is managed through the NightPigeon dashboard" }),
      ],
    });
  },
};
