import { Message, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { findByCaseId, updateReasonByCaseId } from "../store/infractions";

export const editNoteCommand: Command = {
  name: "editnote",
  aliases: ["updatenote", "notereason"],
  description: "Edit the text of an existing staff note by its case ID",
  usage: "<caseID> <new text>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const caseId = args[0];
    if (!caseId) return message.reply(usageErr(message, editNoteCommand, "Provide a case ID"));

    const newText = args.slice(1).join(" ").trim();
    if (!newText) return message.reply(usageErr(message, editNoteCommand, "Provide the new note text"));

    const result = findByCaseId(message.guild.id, caseId);
    if (!result) return message.reply(`❌ No case found with ID \`${caseId}\` in this server.`);

    if (result.infraction.type !== "Note") {
      return message.reply(`❌ Case \`${caseId}\` is a **${result.infraction.type}**, not a Note. Use \`>reason\` to update non-note cases.`);
    }

    const oldText = result.infraction.reason;
    updateReasonByCaseId(message.guild.id, caseId, newText);

    let targetTag = result.userId;
    try {
      const user = await message.client.users.fetch(result.userId);
      targetTag = user.tag;
    } catch {}

    await message.reply(
      `✏️ Updated note \`${caseId}\` on **${targetTag}**.\n` +
      `**Before:** ${oldText}\n` +
      `**After:** ${newText}`
    );
  },
};
