import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { addInfraction } from "../store/infractions";
import { resolveTarget, getArgs } from "../lib/resolveUser";

export const noteCommand: Command = {
  name: "note",
  aliases: ["addnote", "staffnote"],
  description: "Attach a private staff note to a user's infraction record (user is not notified)",
  usage: "<@user | userID> <note text>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const resolved = await resolveTarget(message, args);
    if (!resolved) return message.reply(usageErr(message, noteCommand, "Mention a user or provide a valid user ID"));

    const { user: target } = resolved;
    const text = getArgs(message, args).join(" ");

    if (!text) return message.reply(usageErr(message, noteCommand, "Provide the note text"));

    const infraction = addInfraction(message.guild.id, target.id, {
      type: "Note",
      reason: text,
      moderatorId: message.author.id,
      moderatorTag: message.author.tag,
    });

    await message.reply(`✏️ Noted **${target.tag}** (\`${infraction.id}\`)`);
  },
};
