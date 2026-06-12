import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { addModRole, removeModRole, getModRoles, clearModRoles } from "../store/modroles";

export const modroleCommand: Command = {
  name: "modrole",
  aliases: ["mr"],
  description: "Manage roles that can use moderation commands",
  usage: "add <@role> | remove <@role> | list | clear",
  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    if (sub === "add") {
      const role = message.mentions.roles.first() ?? message.guild.roles.cache.get(args[1] ?? "");
      if (!role) return message.reply(usageErr(message, modroleCommand, "Mention a role or provide a valid role ID"));
      const added = addModRole(guildId, role.id);
      return message.reply(
        added
          ? `✅ <@&${role.id}> can now use moderation commands.`
          : `ℹ️ <@&${role.id}> is already a mod role.`
      );
    }

    if (sub === "remove" || sub === "del") {
      const role = message.mentions.roles.first() ?? message.guild.roles.cache.get(args[1] ?? "");
      if (!role) return message.reply(usageErr(message, modroleCommand, "Mention a role or provide a valid role ID"));
      const removed = removeModRole(guildId, role.id);
      return message.reply(
        removed
          ? `✅ <@&${role.id}> removed from mod roles.`
          : `❌ <@&${role.id}> is not a mod role.`
      );
    }

    if (sub === "list" || !sub) {
      const roles = getModRoles(guildId);
      if (!roles.length) return message.reply("No mod roles configured yet.");
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Mod Roles")
        .setDescription(roles.map((id) => `<@&${id}>`).join("\n"));
      return message.reply({ embeds: [embed] });
    }

    if (sub === "clear") {
      clearModRoles(guildId);
      return message.reply("✅ All mod roles cleared.");
    }

    return message.reply(usageErr(message, modroleCommand, "Invalid subcommand — use add, remove, list, or clear"));
  },
};
