import { Message, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { findByCaseId, updateReasonByCaseId } from "../store/infractions";
import { sendModLog } from "../lib/modlog";

export const reasonCommand: Command = {
  name: "reason",
  aliases: [],
  description: "Update the reason for an existing case",
  usage: "<caseID> <new reason>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const caseId = args[0];
    if (!caseId) return message.reply(usageErr(message, reasonCommand, "Provide a case ID"));

    const newReason = args.slice(1).join(" ").trim();
    if (!newReason) return message.reply(usageErr(message, reasonCommand, "Provide a new reason"));

    const result = findByCaseId(message.guild.id, caseId);
    if (!result) return message.reply("❌ No case found with that ID.");

    const updated = updateReasonByCaseId(message.guild.id, caseId, newReason);
    if (!updated) return message.reply("❌ Failed to update the case reason.");

    await message.reply(
      `✅ Updated reason for case \`${caseId}\` to: **${newReason}**`
    );

    let targetTag = updated.userId;
    try {
      const user = await message.client.users.fetch(updated.userId);
      targetTag = user.tag;
    } catch {}

    await sendModLog(message.client, message.guild.id, {
      action: `Reason Updated (${updated.type})`,
      executor: { tag: message.author.tag, id: message.author.id },
      target: { tag: targetTag, id: updated.userId },
      reason: newReason,
      caseId,
      color: 0x3498db,
    });
  },
};
