import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { getInfractions, findByCaseId } from "../store/infractions";
import { resolveTarget } from "../lib/resolveUser";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export const viewNoteCommand: Command = {
  name: "viewnote",
  aliases: ["shownote", "getnote", "notes"],
  description: "View all notes on a user, or look up a single note by case ID",
  usage: "<@user | userID | caseID>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const query = args[0];
    if (!query) return message.reply(usageErr(message, viewNoteCommand, "Provide a user or case ID"));

    // Try to look up as a case ID first (purely numeric / long ID)
    if (/^\d{10,}$/.test(query)) {
      const byCase = findByCaseId(message.guild.id, query);
      if (byCase && byCase.infraction.type === "Note") {
        const inf = byCase.infraction;
        let targetTag = byCase.userId;
        try {
          const u = await message.client.users.fetch(byCase.userId);
          targetTag = u.tag;
        } catch {}

        const embed = new EmbedBuilder()
          .setColor(0x4faaff)
          .setTitle("📝 Note")
          .addFields(
            { name: "User", value: `${targetTag} (${byCase.userId})`, inline: true },
            { name: "Moderator", value: inf.moderatorTag, inline: true },
            { name: "Case ID", value: `\`${inf.id}\``, inline: true },
            { name: "Note", value: inf.reason },
            { name: "Date", value: formatDate(inf.timestamp), inline: true },
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }
    }

    // Otherwise treat as a user target
    const resolved = await resolveTarget(message, args);
    if (!resolved) return message.reply("❌ Could not find that user or note.");

    const { user: target } = resolved;
    const all = getInfractions(message.guild.id, target.id);
    const notes = all.filter(i => i.type === "Note");

    if (notes.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
        .setDescription("No staff notes on record for this user.")
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    const lines = notes.map(n =>
      `**\`${n.id}\`** — ${formatDate(n.timestamp)}\n${n.reason}\n*by ${n.moderatorTag}*`
    );

    // Chunk into embeds if needed
    const chunks: string[][] = [[]];
    for (const line of lines) {
      const cur = chunks[chunks.length - 1]!;
      if ((cur.join("\n\n") + "\n\n" + line).length > 3900) {
        chunks.push([line]);
      } else {
        cur.push(line);
      }
    }

    for (let i = 0; i < chunks.length; i++) {
      const embed = new EmbedBuilder()
        .setColor(0x4faaff)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
        .setTitle(i === 0 ? `📝 Staff Notes (${notes.length})` : null as any)
        .setDescription(chunks[i]!.join("\n\n"))
        .setFooter({ text: `${notes.length} note${notes.length !== 1 ? "s" : ""} · Use >delnote <caseID> to remove` })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
    }
  },
};
