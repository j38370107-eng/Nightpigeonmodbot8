import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { dbGet } from "../store/db";

const DASHBOARD_URL = process.env["DASHBOARD_URL"] ?? "https://utilitypulse-dashboard-pzu9.onrender.com";

export const applyCommand: Command = {
  name: "apply",
  aliases: ["application", "app"],
  description: "Post application form links so members can apply",
  usage: "[form name]",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const forms = await dbGet<Record<string, any>>("applicationForms", message.guild.id);
    const allForms = forms ? Object.values(forms) : [];
    const activeForms = allForms.filter((f) => f.active);

    if (activeForms.length === 0) {
      return message.reply("❌ This server has no active application forms. Create one in the dashboard first.");
    }

    // If a name was given, match a specific form
    if (args.length > 0) {
      const query = args.join(" ").toLowerCase();
      const match = activeForms.find(
        (f) => f.title.toLowerCase().includes(query) || f.id === query
      );
      if (!match) {
        const names = activeForms.map((f) => `\`${f.title}\``).join(", ");
        return message.reply(`❌ No active form matching that name. Available forms: ${names}`);
      }
      return sendFormEmbed(message, match);
    }

    // No args — post all active forms
    for (const form of activeForms) {
      await sendFormEmbed(message, form);
    }
  },
};

async function sendFormEmbed(message: Message, form: any) {
  const link = `${DASHBOARD_URL}/apply/${message.guild!.id}/${form.id}`;

  const embed = new EmbedBuilder()
    .setColor(0xf0a500)
    .setTitle(`📋 ${form.title}`)
    .setDescription(
      (form.description ? `${form.description}\n\n` : "") +
      `Click the button below to open the application form.\n\`${link}\``
    )
    .addFields({ name: "Questions", value: `${form.questions?.length ?? 0}`, inline: true })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Open Application")
      .setStyle(ButtonStyle.Link)
      .setURL(link)
  );

  await message.channel.send({ embeds: [embed], components: [row] });
}
