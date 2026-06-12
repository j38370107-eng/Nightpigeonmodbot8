import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  setShortcut,
  deleteShortcut,
  listShortcuts,
  type ShortcutType,
} from "../store/shortcuts";

const VALID_TYPES: ShortcutType[] = ["warn", "mute", "kick", "ban"];

const DURATION_RE = /^(\d+)(s|m|h|d)$/i;

const MAX_BAN_SECONDS = 30 * 24 * 3600; // 30 days — mirrors the >ban command cap

function parseDurationSeconds(input: string): number | null {
  const match = input.match(DURATION_RE);
  if (!match) return null;
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 1);
}

const TYPE_COLORS: Record<ShortcutType, number> = {
  warn: 0xf1c40f,
  mute: 0xf39c12,
  kick: 0xe67e22,
  ban: 0xe74c3c,
};

const TYPE_EMOJIS: Record<ShortcutType, string> = {
  warn: "⚠️",
  mute: "🔇",
  kick: "👢",
  ban: "🔨",
};

export const shortcutCommand: Command = {
  name: "shortcut",
  aliases: ["sc"],
  description: "Create shortcut punishment commands",
  usage:
    "warn|mute|kick|ban <name> [duration (mute role: optional for permanent, timeout: required)] <reason>  |  list  |  delete <name>",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;

    const sub = args[0]?.toLowerCase();

    if (!sub) {
      return message.reply(usageErr(message, shortcutCommand, "Provide a subcommand"));
    }

    if (sub === "list") {
      const shortcuts = listShortcuts(guildId);
      if (!shortcuts.length) return message.reply("No shortcuts configured yet.");

      const lines = shortcuts.map((s) => {
        const base = `${TYPE_EMOJIS[s.type]} **${s.name}** → ${s.type}`;
        const dur = s.duration ? ` (${s.duration})` : "";
        return `${base}${dur} — ${s.reason}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Shortcuts")
        .setDescription(lines.join("\n"));

      return message.reply({ embeds: [embed] });
    }

    if (sub === "delete" || sub === "del" || sub === "remove") {
      const name = args[1]?.toLowerCase();
      if (!name) return message.reply(usageErr(message, shortcutCommand, "Provide a shortcut name to delete"));
      const removed = deleteShortcut(guildId, name);
      return message.reply(removed ? `✅ Deleted shortcut \`${name}\`.` : `❌ No shortcut named \`${name}\`.`);
    }

    if ((VALID_TYPES as string[]).includes(sub)) {
      const type = sub as ShortcutType;
      const name = args[1]?.toLowerCase();
      if (!name) return message.reply(usageErr(message, shortcutCommand, "Provide a name for the shortcut"));

      const cmdCollection = (message.client as any).commands;
      if (cmdCollection?.has(name)) {
        return message.reply(`❌ \`${name}\` is a built-in bot command or alias and cannot be used as a shortcut name.`);
      }

      const existing = listShortcuts(guildId);
      const isDuplicate = existing.some((s) => s.name === name);
      if (isDuplicate) {
        return message.reply(`❌ A shortcut named \`${name}\` already exists. Use \`>shortcut delete ${name}\` first, then recreate it.`);
      }
      if (existing.length >= 50) {
        return message.reply("❌ You've reached the limit of **50 shortcuts**. Delete one first with `>shortcut delete <name>`.");
      }

      if (type === "mute") {
        const maybeDuration = args[2];
        const hasDuration = DURATION_RE.test(maybeDuration ?? "");
        if (hasDuration) {
          const reason = args.slice(3).join(" ");
          if (!reason) return message.reply(usageErr(message, shortcutCommand, "Provide a reason"));
          setShortcut(guildId, { name, type, reason, duration: maybeDuration });
          return message.reply(`✅ Shortcut \`${name}\` created — \`>${name} @user\` will mute for **${maybeDuration}**: *${reason}*`);
        } else {
          // No duration — permanent mute (mute role mode only; timeout mode will require a duration at runtime)
          const reason = args.slice(2).join(" ");
          if (!reason) return message.reply(usageErr(message, shortcutCommand, "Provide a reason"));
          setShortcut(guildId, { name, type, reason });
          return message.reply(`✅ Shortcut \`${name}\` created — \`>${name} @user\` will permanently mute (mute role mode): *${reason}*`);
        }
      } else if (type === "ban") {
        // Duration is optional for bans
        const maybeDuration = args[2];
        const hasDuration = (d: string | undefined) => DURATION_RE.test(d ?? "");
        if (hasDuration(maybeDuration)) {
          const seconds = parseDurationSeconds(maybeDuration!);
          if (seconds !== null && seconds > MAX_BAN_SECONDS) {
            return message.reply("❌ Max ban duration is **30 days**. Omit the duration for a permanent ban shortcut.");
          }
          const reason = args.slice(3).join(" ");
          if (!reason) return message.reply(usageErr(message, shortcutCommand, "Provide a reason"));
          setShortcut(guildId, { name, type, reason, duration: maybeDuration });
          return message.reply(`✅ Shortcut \`${name}\` created — \`>${name} @user\` will ban for **${maybeDuration}**: *${reason}*`);
        } else {
          const reason = args.slice(2).join(" ");
          if (!reason) return message.reply(usageErr(message, shortcutCommand, "Provide a reason"));
          setShortcut(guildId, { name, type, reason });
          return message.reply(`✅ Shortcut \`${name}\` created — \`>${name} @user\` will permanently ban: *${reason}*`);
        }
      } else {
        const reason = args.slice(2).join(" ");
        if (!reason) return message.reply(usageErr(message, shortcutCommand, "Provide a reason"));
        setShortcut(guildId, { name, type, reason });
        return message.reply(`✅ Shortcut \`${name}\` created — \`>${name} @user\` will ${type}: *${reason}*`);
      }
    }

    return message.reply(usageErr(message, shortcutCommand, "Invalid subcommand — use warn, mute, kick, ban, list, or delete"));
  },
};
