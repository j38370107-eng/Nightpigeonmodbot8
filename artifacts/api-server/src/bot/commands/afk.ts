import { Message, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { setAfk, clearAfk } from "../store/afk";

export const afkCommand: Command = {
  name: "afk",
  aliases: [],
  description: "Set your AFK status. The bot will notify others when they mention you.",
  usage: "[reason]",
  requiredPermissions: [],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const reason = args.join(" ").trim() || "AFK";
    setAfk(message.guild.id, message.author.id, reason);

    await message.reply(`💤 You are now AFK: **${reason}**`);
  },
};

export const afkResetCommand: Command = {
  name: "afkreset",
  aliases: [],
  description: "Manually clear your AFK status",
  usage: "[userID (mod only)]",
  requiredPermissions: [],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    // Mods can reset someone else's AFK
    let targetId = message.author.id;
    if (args[0] && message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      const mention = message.mentions.users.first();
      targetId = mention?.id ?? args[0];
    }

    const cleared = clearAfk(message.guild.id, targetId);
    if (!cleared) {
      return message.reply("❌ That user is not currently AFK.");
    }

    const display = targetId === message.author.id ? "Your" : `<@${targetId}>'s`;
    await message.reply(`✅ ${display} AFK status has been cleared.`);
  },
};
