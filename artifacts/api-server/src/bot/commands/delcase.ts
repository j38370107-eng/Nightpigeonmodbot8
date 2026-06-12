import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { removeByCaseId, getInfractions } from "../store/infractions";

export const delCaseCommand: Command = {
  name: "delcase",
  aliases: ["deletecase", "removecase", "rmcase"],
  description: "Delete a specific infraction by its case ID",
  usage: "<caseID>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const caseId = args[0];
    if (!caseId) {
      return message.reply(usageErr(message, delCaseCommand, "Provide a case ID"));
    }

    const removed = removeByCaseId(message.guild.id, caseId);

    if (!removed) {
      return message.reply(`❌ No infraction found with case ID \`${caseId}\` in this server.`);
    }

    let targetTag = removed.userId;
    try {
      const user = await message.client.users.fetch(removed.userId);
      targetTag = user.tag;
    } catch {}

    const remaining = getInfractions(message.guild.id, removed.userId).length;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🗑️ Case Deleted")
      .addFields(
        { name: "User", value: `${targetTag} (${removed.userId})`, inline: true },
        { name: "Moderator", value: message.author.tag, inline: true },
        { name: "Type", value: removed.type, inline: true },
        { name: "Case ID", value: `\`${caseId}\``, inline: true },
        { name: "Reason was", value: removed.reason },
        { name: "Remaining Infractions", value: String(remaining), inline: true }
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
