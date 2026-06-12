import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { addAlt, removeAlt, getAlts, getMainAccount, clearAlts } from "../store/alts";

export const altCommand: Command = {
  name: "alt",
  aliases: [],
  description: "Track alt accounts linked to a main account",
  usage: "add <@main> <@alt> | remove <@alt> | list <@user>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    if (sub === "add") {
      const mentions = [...message.mentions.users.values()];
      let mainUser: any = mentions[0];
      let altUser: any = mentions[1];

      if (!mainUser && args[1]) {
        mainUser = await message.client.users.fetch(args[1]).catch(() => null);
      }
      if (!altUser && args[2]) {
        altUser = await message.client.users.fetch(args[2]).catch(() => null);
      }

      if (!mainUser || !altUser) {
        return message.reply(usageErr(message, altCommand, "Provide both a main and alt user"));
      }
      if (mainUser.id === altUser.id) {
        return message.reply("❌ Main and alt cannot be the same user.");
      }

      const added = addAlt(guildId, mainUser.id, altUser.id);
      return message.reply(
        added
          ? `✅ Linked <@${altUser.id}> as an alt of <@${mainUser.id}>.`
          : `❌ <@${altUser.id}> is already linked as an alt of <@${mainUser.id}>.`
      );
    }

    if (sub === "remove") {
      const altUser = message.mentions.users.first() ?? (args[1] ? { id: args[1] } : null);
      if (!altUser) return message.reply(usageErr(message, altCommand, "Provide the alt account to remove"));

      const removed = removeAlt(guildId, altUser.id);
      return message.reply(
        removed
          ? `✅ Removed <@${altUser.id}> from alt tracking.`
          : `❌ <@${altUser.id}> is not tracked as an alt.`
      );
    }

    if (sub === "list" || sub === "check") {
      const target = message.mentions.users.first() ?? (args[1] ? await message.client.users.fetch(args[1]).catch(() => null) : null);
      if (!target) return message.reply(usageErr(message, altCommand, "Mention a user or provide their ID"));

      const alts = getAlts(guildId, target.id);
      const mainId = getMainAccount(guildId, target.id);

      const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`Alt Accounts — <@${target.id}>`);

      const lines: string[] = [];
      if (mainId) lines.push(`**Main Account:** <@${mainId}>`);
      if (alts.length) lines.push(`**Known Alts:**\n${alts.map((id) => `<@${id}>`).join("\n")}`);
      if (!lines.length) lines.push("No alt accounts linked to this user.");

      embed.setDescription(lines.join("\n\n"));
      return message.reply({ embeds: [embed] });
    }

    return message.reply(usageErr(message, altCommand, "Invalid subcommand — use add, remove, or list"));
  },
};

export const clearAltCommand: Command = {
  name: "clearalt",
  aliases: [],
  description: "Remove all alt accounts linked to a user",
  usage: "<@user | userID>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const target = message.mentions.users.first() ?? (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!target) return message.reply(usageErr(message, clearAltCommand, "Mention a user or provide their ID"));

    const count = clearAlts(message.guild.id, target.id);
    return message.reply(
      count > 0
        ? `✅ Cleared **${count}** alt${count === 1 ? "" : "s"} linked to <@${target.id}>.`
        : `❌ No alts are linked to <@${target.id}>.`
    );
  },
};
