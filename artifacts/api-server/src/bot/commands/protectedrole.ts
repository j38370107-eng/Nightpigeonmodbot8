import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { addProtectedRole, removeProtectedRole, getProtectedRoles } from "../store/protectedRoles";

export const protectedRoleCommand: Command = {
  name: "protectedrole",
  aliases: ["protrole"],
  description: "Manage roles that are immune to punishments",
  usage: "add <@role> | remove <@role> | list",
  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    if (sub === "add") {
      const role =
        message.mentions.roles.first() ??
        message.guild.roles.cache.get(args[1] ?? "");
      if (!role) return message.reply(usageErr(message, protectedRoleCommand, "Mention a role or provide a valid role ID"));
      const added = addProtectedRole(guildId, role.id);
      return message.reply(
        added
          ? `✅ <@&${role.id}> is now a protected role — members with this role cannot be punished.`
          : `ℹ️ <@&${role.id}> is already protected.`,
      );
    }

    if (sub === "remove" || sub === "del") {
      const role =
        message.mentions.roles.first() ??
        message.guild.roles.cache.get(args[1] ?? "");
      if (!role) return message.reply(usageErr(message, protectedRoleCommand, "Mention a role or provide a valid role ID"));
      const removed = removeProtectedRole(guildId, role.id);
      return message.reply(
        removed
          ? `✅ <@&${role.id}> is no longer protected.`
          : `❌ <@&${role.id}> is not a protected role.`,
      );
    }

    const roles = getProtectedRoles(guildId);
    if (!roles.length) return message.reply("No protected roles configured. Use `>protectedrole add <@role>` to add one.");
    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle("🛡️ Protected Roles")
      .setDescription(roles.map((id) => `<@&${id}>`).join("\n"))
      .setFooter({ text: "Members with these roles cannot be warned, muted, kicked, or banned." });
    return message.reply({ embeds: [embed] });
  },
};
