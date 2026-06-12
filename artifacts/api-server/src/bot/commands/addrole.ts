import { Message, PermissionFlagsBits, Role } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";
import { resolveTarget } from "../lib/resolveUser";
import { getExecutorMember, isHierarchyBlocked } from "../lib/hierarchy";

async function resolveRole(message: Message, args: string[]): Promise<Role | null> {
  if (!message.guild) return null;

  if (message.mentions.roles.first()) return message.mentions.roles.first()!;

  const roleArg = args.slice(1).join(" ").trim();
  if (!roleArg) return null;

  await message.guild.roles.fetch();

  const byId = message.guild.roles.cache.get(roleArg.replace(/[<@&>]/g, ""));
  if (byId) return byId;

  const lower = roleArg.toLowerCase();

  const exact = message.guild.roles.cache.find((r) => r.name.toLowerCase() === lower);
  if (exact) return exact;

  const partial = message.guild.roles.cache.find((r) => r.name.toLowerCase().startsWith(lower));
  if (partial) return partial;

  return null;
}

export const addRoleCommand: Command = {
  name: "addrole",
  aliases: ["ar"],
  description: "Add a role to a member",
  usage: "<@user | userID> <@role | roleID | role name>",
  requiredPermissions: [PermissionFlagsBits.ManageRoles],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const resolved = await resolveTarget(message, args);
    if (!resolved) return message.reply(usageErr(message, addRoleCommand, "Mention a user or provide a valid user ID"));

    const { user: target, member } = resolved;
    if (!member) return message.reply("❌ That user is not in this server.");

    const executorMember = await getExecutorMember(message);
    if (executorMember && isHierarchyBlocked(executorMember, member)) {
      return message.reply("❌ You cannot add roles to someone with an equal or higher role than you.");
    }

    const role = await resolveRole(message, args);
    if (!role) return message.reply(usageErr(message, addRoleCommand, "Could not find that role — try a mention, ID, or name"));
    if (role.managed) return message.reply("❌ That role is managed by an integration and cannot be assigned.");
    if (role.position >= (message.guild.members.me?.roles.highest.position ?? 0)) {
      return message.reply("❌ That role is higher than or equal to my highest role.");
    }

    if (member.roles.cache.has(role.id)) {
      return message.reply(`❌ <@${target.id}> already has the **${role.name}** role.`);
    }

    try {
      await member.roles.add(role, `Added by ${message.author.tag}`);
      await message.channel.send(`✅ Added **${role.name}** to <@${target.id}>.`);
      await message.delete().catch(() => {});

      await sendModLog(message.client, message.guild.id, {
        action: "Role Added",
        executor: { tag: message.author.tag, id: message.author.id },
        target: { tag: target.tag, id: target.id },
        reason: `Role: ${role.name} (${role.id})`,
        color: 0x2ecc71,
      });

      logger.info({ targetId: target.id, roleId: role.id }, "Role added");
    } catch (err) {
      logger.error({ err }, "Failed to add role");
      await message.reply("❌ Failed to add the role.");
    }
  },
};

export const removeRoleCommand: Command = {
  name: "removerole",
  aliases: ["rr"],
  description: "Remove a role from a member",
  usage: "<@user | userID> <@role | roleID | role name>",
  requiredPermissions: [PermissionFlagsBits.ManageRoles],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const resolved = await resolveTarget(message, args);
    if (!resolved) return message.reply(usageErr(message, removeRoleCommand, "Mention a user or provide a valid user ID"));

    const { user: target, member } = resolved;
    if (!member) return message.reply("❌ That user is not in this server.");

    const executorMemberRR = await getExecutorMember(message);
    if (executorMemberRR && isHierarchyBlocked(executorMemberRR, member)) {
      return message.reply("❌ You cannot remove roles from someone with an equal or higher role than you.");
    }

    const role = await resolveRole(message, args);
    if (!role) return message.reply(usageErr(message, removeRoleCommand, "Could not find that role — try a mention, ID, or name"));
    if (role.managed) return message.reply("❌ That role is managed by an integration and cannot be removed.");
    if (role.position >= (message.guild.members.me?.roles.highest.position ?? 0)) {
      return message.reply("❌ That role is higher than or equal to my highest role.");
    }

    if (!member.roles.cache.has(role.id)) {
      return message.reply(`❌ <@${target.id}> does not have the **${role.name}** role.`);
    }

    try {
      await member.roles.remove(role, `Removed by ${message.author.tag}`);
      await message.channel.send(`✅ Removed **${role.name}** from <@${target.id}>.`);
      await message.delete().catch(() => {});

      await sendModLog(message.client, message.guild.id, {
        action: "Role Removed",
        executor: { tag: message.author.tag, id: message.author.id },
        target: { tag: target.tag, id: target.id },
        reason: `Role: ${role.name} (${role.id})`,
        color: 0xe74c3c,
      });

      logger.info({ targetId: target.id, roleId: role.id }, "Role removed");
    } catch (err) {
      logger.error({ err }, "Failed to remove role");
      await message.reply("❌ Failed to remove the role.");
    }
  },
};
