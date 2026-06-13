import { Client, Message, EmbedBuilder } from "discord.js";
import type { Command } from "../types";
import { getCachedConfig } from "../../store/guildConfig";
import { getUserLevel } from "../../lib/yamlLevels";

const helpCmd: Command = {
  name: "help",
  aliases: ["h", "commands"],
  usage: "[command]",
  description: "List available commands.",
  async execute(message: Message, args: string[], _client: Client) {
    if (!message.guild) return;

    const cfg = getCachedConfig(message.guild.id);
    const prefix = cfg.prefix ?? "!";
    const userLevel = getUserLevel(message);
    const cmdLevels = cfg.levels.commands ?? {};

    const modCommands = [
      ["warn", "Warn a member"],
      ["mute", "Mute a member (with optional duration)"],
      ["unmute", "Unmute a member"],
      ["kick", "Kick a member"],
      ["ban", "Ban a member (with optional duration)"],
      ["unban", "Unban a user by ID"],
      ["purge", "Bulk delete messages"],
      ["slowmode", "Set or remove slowmode"],
    ].filter(([name]) => userLevel >= (cmdLevels[name!] ?? 0));

    const utilCommands = [
      ["tag", "Show a server tag"],
      ["userinfo", "Show info about a user"],
      ["help", "Show this message"],
    ].filter(([name]) => userLevel >= (cmdLevels[name!] ?? 0));

    const tags = Object.keys(cfg.tags ?? {});
    const aliases = cfg.plugins.command_aliases?.config?.aliases ?? {};

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📖 NightPigeon Commands")
      .setDescription(`Prefix: \`${prefix}\` | Your level: **${userLevel}**`)
      .setFooter({ text: `Use ${prefix}help <command> for details` });

    if (modCommands.length > 0) {
      embed.addFields({
        name: "⚔️ Moderation",
        value: modCommands.map(([n, d]) => `\`${prefix}${n}\` — ${d}`).join("\n"),
      });
    }

    if (utilCommands.length > 0) {
      embed.addFields({
        name: "🔧 Utility",
        value: utilCommands.map(([n, d]) => `\`${prefix}${n}\` — ${d}`).join("\n"),
      });
    }

    if (tags.length > 0) {
      embed.addFields({
        name: "🏷️ Tags",
        value: tags.map((t) => `\`${prefix}tag ${t}\` or \`${prefix}${t}\``).join(", "),
      });
    }

    if (Object.keys(aliases).length > 0) {
      const aliasList = Object.entries(aliases)
        .slice(0, 20)
        .map(([a, c]) => `\`${prefix}${a}\` → \`${prefix}${c}\``)
        .join(", ");
      embed.addFields({ name: "⚡ Aliases", value: aliasList });
    }

    await message.channel.send({ embeds: [embed] });
  },
};

export default helpCmd;
