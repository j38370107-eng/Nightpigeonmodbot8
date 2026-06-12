import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { setAlias, deleteAlias, listAliases } from "../store/aliases";
import { commands } from "./index";

function resolveCommand(name: string): Command | null {
  return commands.find((c) => c.name === name || c.aliases.includes(name)) ?? null;
}

export const aliasCommand: Command = {
  name: "alias",
  aliases: [],
  description: "Create custom aliases for any command",
  usage: "add <alias> <command> | remove <alias> | list",
  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    // ── list ─────────────────────────────────────────────────────────────────
    if (!sub || sub === "list") {
      const all = listAliases(guildId);
      const entries = Object.entries(all);
      if (!entries.length) {
        return message.reply("No custom aliases set. Use `>alias add <alias> <command>` to create one.");
      }
      const lines = entries.map(([alias, cmd]) => `\`${alias}\` → \`${cmd}\``);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Custom Aliases")
        .setDescription(lines.join("\n"))
        .setFooter({ text: `${entries.length} alias${entries.length === 1 ? "" : "es"}` });
      return message.reply({ embeds: [embed] });
    }

    // ── add ──────────────────────────────────────────────────────────────────
    if (sub === "add" || sub === "set") {
      const alias = args[1]?.toLowerCase();
      const target = args[2]?.toLowerCase();

      if (!alias || !target) {
        return message.reply(usageErr(message, aliasCommand, "Provide both an alias and a command — e.g. b ban"));
      }

      const cmd = resolveCommand(target);
      if (!cmd) {
        return message.reply(usageErr(message, aliasCommand, `Unknown command "${target}" — check >help for the full list`));
      }

      // Prevent overwriting built-in command names
      if (resolveCommand(alias)) {
        return message.reply(`❌ \`${alias}\` is already a built-in command name or alias.`);
      }

      // Cap: each command can have at most 10 custom aliases
      const all = listAliases(guildId);
      const pointingToCmd = Object.entries(all).filter(
        ([a, c]) => c === cmd.name && a !== alias
      ).length;
      if (pointingToCmd >= 10) {
        return message.reply(`❌ \`${cmd.name}\` already has 10 aliases. Remove one first with \`>alias remove <alias>\`.`);
      }

      setAlias(guildId, alias, cmd.name);
      return message.reply(`✅ \`${alias}\` is now an alias for \`${cmd.name}\`. (${pointingToCmd + 1}/10 aliases used)`);
    }

    // ── remove ───────────────────────────────────────────────────────────────
    if (sub === "remove" || sub === "delete" || sub === "del") {
      const alias = args[1]?.toLowerCase();
      if (!alias) return message.reply(usageErr(message, aliasCommand, "Provide the alias to remove"));
      const removed = deleteAlias(guildId, alias);
      return message.reply(
        removed ? `✅ Removed alias \`${alias}\`.` : `❌ No alias named \`${alias}\`.`
      );
    }

    return message.reply(usageErr(message, aliasCommand, "Invalid subcommand — use add, remove, or list"));
  },
};
