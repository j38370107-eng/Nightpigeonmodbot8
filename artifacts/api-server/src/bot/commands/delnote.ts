import { Message, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { findByCaseId, removeByCaseId } from "../store/infractions";

export const delNoteCommand: Command = {
  name: "delnote",
  aliases: ["deletenote", "removenote", "rmnote"],
  description: "Delete a staff note by its case ID",
  usage: "<caseID>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const caseId = args[0];
    if (!caseId) return message.reply(usageErr(message, delNoteCommand, "Provide a note case ID"));

    const result = findByCaseId(message.guild.id, caseId);
    if (!result) return message.reply(`❌ No case found with ID \`${caseId}\` in this server.`);

    if (result.infraction.type !== "Note") {
      return message.reply(`❌ Case \`${caseId}\` is a **${result.infraction.type}**, not a Note. Use \`>delcase\` to remove non-note cases.`);
    }

    removeByCaseId(message.guild.id, caseId);

    let targetTag = result.userId;
    try {
      const user = await message.client.users.fetch(result.userId);
      targetTag = user.tag;
    } catch {}

    await message.reply(`🗑️ Deleted note \`${caseId}\` on **${targetTag}**.`);
  },
};
