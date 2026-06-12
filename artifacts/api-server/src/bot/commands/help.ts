import { Message, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { getPrefix } from "../store/prefixes";
import { commands } from "./index";
import { listShortcuts, getShortcut } from "../store/shortcuts";
import { getCustomCommands, getCustomCommand } from "../store/customCommands";
import { memberHasModRole } from "../store/modroles";
import { OWNER_ID } from "../store/ownerBlacklists";

const OWNER_COMMANDS = ["eval", "serverblacklist", "userblacklist"];

const CATEGORIES: { name: string; emoji: string; commands: string[] }[] = [
  {
    name: "Moderation",
    emoji: "🔨",
    commands: [
      "ban", "unban", "kick", "mute", "unmute", "warn",
      "purge", "slowmode", "lock", "unlock", "lockdown",
      "modnick", "nick",
    ],
  },
  {
    name: "Cases & Records",
    emoji: "📋",
    commands: [
      "warnings", "note", "viewnote", "delnote", "editnote",
      "case", "delcase", "reason",
      "baninfo", "duration", "activeactions", "modstats",
    ],
  },
  {
    name: "AutoMod",
    emoji: "🤖",
    commands: [
      "automod", "muteconfig", "setautomodwarnexpiry", "setexpiredate",
    ],
  },
  {
    name: "Security",
    emoji: "🛡️",
    commands: ["antinuke", "antiraid"],
  },
  {
    name: "Permissions",
    emoji: "🔐",
    commands: ["modrole", "protectedrole"],
  },
  {
    name: "Role Management",
    emoji: "🎭",
    commands: ["addrole", "removerole"],
  },
  {
    name: "Configuration",
    emoji: "⚙️",
    commands: [
      "setmodlogs", "setserverlogs", "changeprefix",
      "additionalinformation", "backup", "resetconfig",
    ],
  },
  {
    name: "Tickets",
    emoji: "🎫",
    commands: [
      "ticket", "tblacklist", "tunblacklist",
      "setup", "close", "delete", "reopen",
      "add", "remove", "claim", "transcript", "stats",
    ],
  },
  {
    name: "Applications",
    emoji: "📝",
    commands: ["apply", "ablacklist", "aunblacklist"],
  },
  {
    name: "Invite Tracking",
    emoji: "📨",
    commands: ["invites", "inviteleaderboard"],
  },
  {
    name: "Shortcuts & Aliases",
    emoji: "⚡",
    commands: ["shortcut", "alias"],
  },
  {
    name: "Utility",
    emoji: "🔧",
    commands: [
      "ping", "botinfo", "userinfo", "serverinfo",
      "afk", "afkreset", "remind",
      "alt", "clearalt", "alts",
      "snipe", "editsnipe", "clearsnipe",
      "dashboard", "help",
    ],
  },
];

const TYPE_EMOJIS: Record<string, string> = {
  warn: "⚠️", mute: "🔇", kick: "👢", ban: "🔨",
};

function isModerator(message: Message): boolean {
  if (!message.guild || !message.member) return false;
  if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const roleIds = [...message.member.roles.cache.keys()];
  return memberHasModRole(message.guild.id, roleIds);
}

export const helpCommand: Command = {
  name: "help",
  aliases: ["h", "commands"],
  description: "Show all available commands",
  usage: "[command]",
  requiredPermissions: [],

  async execute(message: Message, args: string[]) {
    const prefix = message.guild ? getPrefix(message.guild.id) : ">";

    // ── Single command / shortcut lookup ────────────────────────────────────
    if (args[0]) {
      const cmdName = args[0].toLowerCase();
      const cmd = commands.find(
        (c) => c.name === cmdName || c.aliases.includes(cmdName),
      );

      if (!cmd) {
        if (message.guild) {
          const shortcut = getShortcut(message.guild.id, cmdName);
          if (shortcut) {
            const embed = new EmbedBuilder()
              .setColor(0xf39c12)
              .setTitle(`${prefix}${shortcut.name}`)
              .setDescription(
                `**Type:** ${TYPE_EMOJIS[shortcut.type] ?? ""} ${shortcut.type}\n**Reason:** ${shortcut.reason}${shortcut.duration ? `\n**Duration:** ${shortcut.duration}` : ""}`,
              )
              .addFields({ name: "Usage", value: `\`${prefix}${shortcut.name} @user\`` })
              .setFooter({ text: "Custom Shortcut" });
            return message.reply({ embeds: [embed] });
          }

          const cc = getCustomCommand(message.guild.id, cmdName);
          if (cc) {
            const embed = new EmbedBuilder()
              .setColor(0x3ba55d)
              .setTitle(`${prefix}${cc.trigger}`)
              .setDescription(cc.response || "_No plain-text response — sends an embed._")
              .setFooter({ text: "Custom Command" });
            if (cc.cooldown > 0) {
              const cdType: Record<string, string> = { user: "per user", channel: "per channel", global: "server-wide" };
              embed.addFields({ name: "Cooldown", value: `${cc.cooldown}s ${cdType[cc.cooldownType] ?? cc.cooldownType}`, inline: true });
            }
            if (cc.allowedRoles.length > 0 || cc.allowedChannels.length > 0) {
              embed.addFields({ name: "Restricted to", value: `${cc.allowedRoles.length} role(s), ${cc.allowedChannels.length} channel(s)`, inline: true });
            }
            return message.reply({ embeds: [embed] });
          }
        }
        return message.reply(
          `❌ No command, shortcut or custom command named \`${args[0]}\` was found. Run \`${prefix}help\` to see all commands.`,
        );
      }

      const category = CATEGORIES.find((cat) => cat.commands.includes(cmd.name));

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${category?.emoji ?? "📌"} ${prefix}${cmd.name}`)
        .setDescription(cmd.description)
        .addFields({
          name: "Usage",
          value: `\`${prefix}${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ""}\``,
          inline: false,
        });

      if (cmd.aliases.length > 0) {
        embed.addFields({
          name: "Aliases",
          value: cmd.aliases.map((a) => `\`${prefix}${a}\``).join("  "),
          inline: false,
        });
      }

      if (category) {
        embed.setFooter({ text: `Category: ${category.emoji} ${category.name}` });
      }

      return message.reply({ embeds: [embed] });
    }

    // ── Category overview ────────────────────────────────────────────────────
    const totalCmds = commands.filter((c) => !OWNER_COMMANDS.includes(c.name)).length;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({
        name: message.client.user?.username ?? "Moderation Bot",
        iconURL: message.client.user?.displayAvatarURL(),
      })
      .setDescription(
        `**${totalCmds} commands** across ${CATEGORIES.length} categories.\nRun \`${prefix}help [command]\` for details on any command.`,
      );

    for (const category of CATEGORIES) {
      const cmdList = category.commands
        .filter((name) => commands.some((c) => c.name === name))
        .map((name) => `\`${name}\``)
        .join(", ");

      if (cmdList) {
        embed.addFields({
          name: `${category.emoji} ${category.name}`,
          value: cmdList,
          inline: false,
        });
      }
    }

    // Owner section
    if (message.author.id === OWNER_ID) {
      const ownerList = OWNER_COMMANDS
        .filter((name) => commands.some((c) => c.name === name))
        .map((name) => `\`${name}\``)
        .join(", ");
      if (ownerList) {
        embed.addFields({ name: "👑 Owner", value: ownerList, inline: false });
      }
    }

    // Server shortcuts (mods only)
    if (message.guild && isModerator(message)) {
      const shortcuts = listShortcuts(message.guild.id);
      if (shortcuts.length > 0) {
        const names = shortcuts
          .map((s) => `\`${s.name}\` ${TYPE_EMOJIS[s.type] ?? ""}`)
          .join("  ");
        embed.addFields({ name: "⚡ Server Shortcuts", value: names, inline: false });
      }
    }

    // Custom commands (visible to everyone)
    if (message.guild) {
      const customCmds = getCustomCommands(message.guild.id);
      if (customCmds.length > 0) {
        const names = customCmds.map((c) => `\`${c.trigger}\``).join("  ");
        embed.addFields({ name: `🛠️ Custom Commands (${customCmds.length})`, value: names, inline: false });
      }
    }

    embed.setFooter({ text: `Prefix: ${prefix}  •  Run ${prefix}help [command] for more info` });

    await message.reply({ embeds: [embed] });
  },
};
