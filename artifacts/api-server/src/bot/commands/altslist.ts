import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { getAllAlts } from "../store/alts";

export const altsListCommand: Command = {
  name: "alts",
  aliases: ["altlist", "linkedalts"],
  description: "List all linked main↔alt account pairings in this server",
  usage: "",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, _args: string[]) {
    if (!message.guild) return;

    const all = getAllAlts(message.guild.id);
    const entries = Object.entries(all).filter(([, alts]) => alts.length > 0);

    if (entries.length === 0) {
      return message.reply("No alt account pairings have been registered in this server.");
    }

    const lines = entries.map(
      ([mainId, alts]) =>
        `**<@${mainId}>** → ${alts.map(id => `<@${id}>`).join(", ")}`,
    );

    const MAX_PER_PAGE = 10;
    const pages: string[] = [];
    for (let i = 0; i < lines.length; i += MAX_PER_PAGE) {
      pages.push(lines.slice(i, i + MAX_PER_PAGE).join("\n"));
    }

    const totalAccounts = entries.reduce((acc, [, alts]) => acc + alts.length, 0);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🔗 Linked Alt Accounts")
      .setDescription(pages[0] ?? "None")
      .setFooter({
        text: `${entries.length} main account${entries.length !== 1 ? "s" : ""} · ${totalAccounts} alt${totalAccounts !== 1 ? "s" : ""} total${pages.length > 1 ? ` · Page 1/${pages.length}` : ""}`,
      });

    await message.reply({ embeds: [embed] });

    for (let i = 1; i < pages.length; i++) {
      const pageEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(pages[i]!)
        .setFooter({ text: `Page ${i + 1}/${pages.length}` });
      await message.channel.send({ embeds: [pageEmbed] });
    }
  },
};
