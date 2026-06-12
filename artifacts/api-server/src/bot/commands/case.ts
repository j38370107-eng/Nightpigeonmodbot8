import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { findByCaseId } from "../store/infractions";

const TYPE_COLORS: Record<string, number> = {
  Ban: 0xe74c3c,
  Unban: 0x2ecc71,
  Kick: 0xe67e22,
  Mute: 0xf39c12,
  Unmute: 0x2ecc71,
  Warn: 0xf1c40f,
  Note: 0x95a5a6,
};

export const caseCommand: Command = {
  name: "case",
  aliases: [],
  description: "Look up a case by its ID",
  usage: "<caseID>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const caseId = args[0];
    if (!caseId) return message.reply(usageErr(message, caseCommand, "Provide a case ID"));

    const result = findByCaseId(message.guild.id, caseId);
    if (!result) return message.reply("❌ No case found with that ID.");

    const { infraction } = result;

    const lines: string[] = [];

    lines.push(`**Type**\n${infraction.type}`);
    lines.push(`**User**\n<@${infraction.userId}> (${infraction.userId})`);
    lines.push(`**Moderator**\n<@${infraction.moderatorId}> (${infraction.moderatorId})`);
    lines.push(`**Reason**\n${infraction.reason}`);
    lines.push(`**Date**\n<t:${Math.floor(infraction.timestamp / 1000)}:F>`);

    if (infraction.expiresAt) {
      lines.push(`**Expires**\n<t:${Math.floor(infraction.expiresAt / 1000)}:F>`);
    }

    lines.push(`**Case ID**\n${infraction.id}`);

    const embed = new EmbedBuilder()
      .setColor(TYPE_COLORS[infraction.type] ?? 0x5865f2)
      .setTitle(`Case — ${infraction.type}`)
      .setDescription(lines.join("\n\n"))
      .setTimestamp(infraction.timestamp);

    await message.reply({ embeds: [embed] });
  },
};
